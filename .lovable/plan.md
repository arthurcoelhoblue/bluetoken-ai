
# Transferencia Manual para Atendente do Blue Chat

## Objetivo

Permitir que, ao clicar em "Transferir" na barra de takeover, o usuario veja duas secoes no seletor:
- **Usuarios Amelia** (profiles do sistema) -- transfere o owner_id como ja funciona
- **Atendentes Blue Chat** (agentes do chat externo) -- transfere o ticket diretamente no Blue Chat via API

---

## Mudancas

### 1. Nova Edge Function `bluechat-proxy` (`supabase/functions/bluechat-proxy/index.ts`)

Uma edge function leve que faz proxy para a API do Blue Chat, com duas acoes:

**Acao `list-agents`:**
- Chama `GET {baseUrl}/agents` (ou endpoint equivalente) na API do Blue Chat
- Retorna a lista de atendentes disponiveis com `id` e `name`
- Autentica com `X-API-Key` (mesmo padrao do callback.ts)

**Acao `transfer-ticket`:**
- Recebe `ticket_id`, `agent_id`, `empresa`
- Chama `POST {baseUrl}/tickets/{ticket_id}/transfer` com `agent_id` no body
- Retorna sucesso/erro

A edge function recebe `empresa` para selecionar a API key correta (`BLUECHAT_API_KEY` ou `BLUECHAT_API_KEY_BLUE`) e busca a `api_url` em `system_settings`.

Requer autenticacao do usuario logado via Bearer token.

### 2. Atualizar `ConversationTakeoverBar.tsx`

**Mudancas no dialog de transferencia:**

- Trocar o `Select` simples por um com dois grupos (`SelectGroup`):
  - Grupo "Usuarios Amelia" -- lista de profiles (como hoje)
  - Grupo "Atendentes Blue Chat" -- lista de agentes do Blue Chat (via edge function)

- Ao abrir o dialog, carregar ambas as listas em paralelo:
  - `profiles` do Supabase (ja existente)
  - Agentes do Blue Chat via `supabase.functions.invoke('bluechat-proxy', { body: { action: 'list-agents', empresa } })`

- O valor selecionado usa um prefixo para diferenciar:
  - `amelia:uuid` para usuarios internos
  - `bluechat:agent_id` para atendentes do Blue Chat

- Na confirmacao (`handleTransfer`):
  - Se prefixo `amelia:` -- comportamento atual (atualiza `owner_id` no `lead_contacts`)
  - Se prefixo `bluechat:` -- chama a edge function de transferencia, que usa o `ticket_id` salvo no `framework_data` do lead para transferir no Blue Chat. Tambem devolve o modo para SDR_IA (Amelia para de responder pois o atendente humano do chat assumiu)

- Para a transferencia Blue Chat funcionar, o componente precisa buscar o `bluechat_ticket_id` do `lead_conversation_state.framework_data`

### 3. Buscar ticket_id do lead

No `ConversationTakeoverBar`, ao abrir o dialog, buscar `framework_data` de `lead_conversation_state` para obter `bluechat_ticket_id`. Este dado ja e persistido pelo `bluechat-inbound` quando o lead chega via Blue Chat.

Se nao houver `bluechat_ticket_id`, o grupo "Atendentes Blue Chat" aparece desabilitado com uma mensagem informando que o lead nao tem conversa ativa no Blue Chat.

---

## Detalhes tecnicos

- A API do Blue Chat usa base URL `https://chat.grupoblue.com.br/api/external-ai` (configurada em `system_settings`)
- Autenticacao via header `X-API-Key` com secrets ja existentes (`BLUECHAT_API_KEY`, `BLUECHAT_API_KEY_BLUE`)
- O `bluechat_ticket_id` e salvo no `framework_data` do `lead_conversation_state` pelo webhook `bluechat-inbound` (linha 609 do index.ts)
- O endpoint de agentes do Blue Chat sera tentado como `GET /agents` -- se a API nao suportar esse endpoint, a edge function retornara lista vazia e o grupo ficara oculto
- O `verify_jwt` da nova edge function sera `false` no config.toml, com validacao via `getClaims()` no codigo
- A transferencia no Blue Chat ja usa o endpoint `POST /tickets/{id}/transfer` -- vamos adicionar o campo `agent_id` ao body (alem de `department`)
