

# Amélia como Agente no Blue Chat vs Chat Interno

## Contexto

Hoje o sistema tem dois canais mutuamente exclusivos por empresa: `bluechat` e `mensageria`. Porém, independente de qual canal está ativo, a Amélia sempre:
- Envia mensagens manuais via `whatsapp-send` direto
- Dispara cadências via `whatsapp-send` direto
- Mostra chat interno com input de mensagem
- No takeover, o humano assume dentro da própria Amélia

A mudanca e fazer com que, **quando o canal `bluechat` estiver ativo**, toda a comunicacao flua pelo Blue Chat:

```text
Canal MENSAGERIA ativo (chat interno):
  Amélia <-> WhatsApp Send <-> Lead (chat vive dentro da Amélia)
  Humano assume -> responde dentro da Amélia

Canal BLUECHAT ativo (Amélia como agente):
  Amélia <-> Blue Chat API <-> Lead (chat vive no Blue Chat)
  Humano assume -> é direcionado para o Blue Chat
  Cadência -> abre/usa conversa no Blue Chat
```

---

## Mudancas

### 1. Criar helper `resolveChannelConfig` (shared)

Um modulo `supabase/functions/_shared/channel-resolver.ts` que, dado empresa + canal do step, consulta `integration_company_config` e decide se deve enviar via WhatsApp direto ou via Blue Chat API.

Retorna: `{ mode: 'DIRECT' | 'BLUECHAT', bluechatApiUrl?, bluechatApiKey? }`

Sera usado pelo `cadence-runner` e pelo `send-manual-message` (nova edge function ou adaptacao).

### 2. Adaptar `cadence-runner/dispararMensagem`

Quando o canal do step e `WHATSAPP` mas a empresa tem `bluechat` ativo em `integration_company_config`:

1. Buscar `bluechat_conversation_id` do `lead_conversation_state.framework_data`
2. Se existir: enviar via Blue Chat API (`POST /messages`) usando o `sendResponseToBluechat` existente
3. Se nao existir: chamar um novo endpoint no `bluechat-proxy` para **iniciar conversa** no Blue Chat (ex: `POST /conversations` com o telefone do lead), salvar o `conversation_id` retornado no `framework_data`, e depois enviar a mensagem
4. Registrar a mensagem normalmente em `lead_messages` com `sender_type = 'AMELIA'`

Se o canal `mensageria` estiver ativo: comportamento atual (whatsapp-send direto).

### 3. Adaptar `ManualMessageInput` e `useSendManualMessage`

Quando o canal `bluechat` estiver ativo para a empresa:

- O `ManualMessageInput` **nao envia mensagem diretamente**
- Em vez disso, mostra um botao "Responder no Blue Chat" que abre o Blue Chat na conversa do lead (usando URL configuravel do Blue Chat + `bluechat_conversation_id` ou `bluechat_ticket_id`)
- Se o usuario insistir em digitar, a mensagem e enviada via Blue Chat API (mesmo caminho do cadence-runner), nao via WhatsApp direto

Isso evita duplicacao: a mensagem aparece no Blue Chat (fonte unica de verdade) e o webhook `bluechat-inbound` ja salva no `lead_messages` da Amelia.

### 4. Adaptar o Takeover ("Assumir Atendimento")

Quando canal `bluechat` ativo:

- **"Assumir atendimento"**: alem de mudar `modo` para `MANUAL`, abre uma nova aba com a URL do Blue Chat para aquela conversa
- O texto do botao muda para "Assumir no Blue Chat"
- **"Devolver a Amelia"**: comportamento identico ao atual (muda modo para `SDR_IA`)

A URL do Blue Chat frontend sera armazenada em `system_settings` (chave `bluechat_frontend_url`, ex: `https://chat.grupoblue.com.br`). O link da conversa sera algo como `{frontend_url}/conversation/{conversation_id}`.

### 5. Nova acao no `bluechat-proxy`: `open-conversation`

Para quando a Amelia precisa iniciar uma conversa proativamente (cadencia ou mensagem manual) com um lead que ainda nao tem `bluechat_conversation_id`:

- Recebe: `empresa`, `telefone`, `nome_lead`
- Chama: `POST {baseUrl}/conversations` com os dados do contato
- Retorna: `conversation_id`, `ticket_id`
- O chamador (cadence-runner ou send-manual) salva no `framework_data`

Se a API do Blue Chat nao suportar esse endpoint, a cadencia falha graciosamente com a mensagem "Lead sem conversa ativa no Blue Chat" (e o sistema de retry/escalacao que acabamos de implementar cuida do resto).

### 6. Hook `useChannelConfig` no frontend

Novo hook que expoe o canal ativo para uma empresa:

```typescript
function useChannelConfig(empresa: string) {
  // Consulta integration_company_config
  // Retorna { isBluechat: boolean, isMensageria: boolean, isLoading }
}
```

Usado pelo `ConversationPanel`, `ManualMessageInput` e `ConversationTakeoverBar` para adaptar o comportamento da UI.

### 7. Adaptar `ConversationPanel`

Quando `bluechat` ativo:
- O `ConversationView` continua mostrando as mensagens (ja sao salvas pelo `bluechat-inbound`)
- O `ManualMessageInput` muda comportamento (item 3)
- Adiciona um badge/link "Ver no Blue Chat" que abre a conversa no Blue Chat

Quando `mensageria` ativo:
- Tudo como esta hoje (chat interno completo)

---

## Detalhes tecnicos

### Arquivos a criar:
- `supabase/functions/_shared/channel-resolver.ts` -- helper para resolver canal ativo
- `src/hooks/useChannelConfig.ts` -- hook frontend para canal ativo

### Arquivos a modificar:
- `supabase/functions/cadence-runner/index.ts` -- `dispararMensagem` verifica canal ativo
- `supabase/functions/bluechat-proxy/index.ts` -- nova acao `open-conversation`
- `src/hooks/useConversationMode.ts` -- `useSendManualMessage` verifica canal
- `src/components/conversas/ManualMessageInput.tsx` -- UI adaptativa
- `src/components/conversas/ConversationTakeoverBar.tsx` -- botao "Assumir no Blue Chat"
- `src/components/conversas/ConversationPanel.tsx` -- badge "Ver no Blue Chat"

### Configuracao necessaria:
- Adicionar `bluechat_frontend_url` em `system_settings` (categoria `integrations`, chaves `bluechat_blue` e `bluechat_tokeniza`) para saber a URL do frontend do Blue Chat

### Sem alteracoes de banco:
- `integration_company_config` ja tem o toggle `bluechat` vs `mensageria`
- `lead_conversation_state.framework_data` ja armazena `bluechat_conversation_id` e `bluechat_ticket_id`
- `system_settings` ja suporta chaves customizaveis

### Fluxo resumido:

```text
Acao do usuario/sistema
  |
  v
Verifica integration_company_config.channel para empresa
  |
  +-- mensageria ativo --> comportamento atual (WhatsApp direto / chat interno)
  |
  +-- bluechat ativo --> redireciona tudo via Blue Chat API
       |
       +-- Cadencia: envia via POST /messages do Blue Chat
       +-- Mensagem manual: envia via Blue Chat (ou redireciona usuario)
       +-- Assumir: abre Blue Chat na conversa do lead
       +-- Devolver: mesmo (muda modo para SDR_IA)
```

### Impacto nas metricas:
- Todas as interacoes ficam centralizadas no Blue Chat
- O `bluechat-inbound` ja salva tudo em `lead_messages`, entao o historico na Amelia continua funcionando como espelho de leitura
- O usuario nao precisa usar dois sistemas simultaneamente
