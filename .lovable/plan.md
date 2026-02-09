
# Integracao ChatBlue 11/10 - Correcoes e Melhorias

## Problemas Criticos Identificados

### 1. MENSAGEM DUPLICADA (Bug Principal)
Hoje, quando o ChatBlue envia uma mensagem para o `bluechat-inbound`, o fluxo chama `sdr-ia-interpret`, que **sempre chama `whatsapp-send`** para enviar a resposta via Mensageria. O ChatBlue **tambem** envia a resposta ao cliente (pois recebe o `response.text` no HTTP 200). Resultado: **cliente recebe 2 mensagens, possivelmente de numeros diferentes**.

### 2. Campo `context.source` nao existe no tipo
O ChatBlue envia `context.source: "BLUECHAT"` no payload, mas o tipo `BlueChatPayload` nao inclui esse campo. Sem ele, nao ha como distinguir mensagens vindas do ChatBlue.

### 3. `sdr-ia-interpret` nao recebe flag de origem
O `bluechat-inbound` chama `sdr-ia-interpret` passando apenas `{ messageId }`. Nao passa nenhuma flag indicando que a mensagem veio do ChatBlue.

### 4. `responseText` nao retorna corretamente
O `sdr-ia-interpret` retorna campos como `intent`, `confidence`, `acao`, `respostaEnviada` -- mas nao retorna `responseText` para o `bluechat-inbound` montar a `BlueChatResponse`.

---

## Solucao Proposta

### Etapa 1: Corrigir payload e tipos

**`bluechat-inbound/index.ts`**:
- Adicionar `source?: string` ao tipo `context` dentro de `BlueChatPayload`
- Adicionar `video` ao tipo `message.type`
- Detectar `isFromBluechat = payload.context?.source === 'BLUECHAT'`

### Etapa 2: Passar flag `source` para `sdr-ia-interpret`

**`bluechat-inbound/index.ts`**:
- Na chamada `callSdrIaInterpret`, passar `source: 'BLUECHAT'` alem do `messageId`

**`sdr-ia-interpret/index.ts`**:
- Receber `source` no body da request
- Na funcao `sendAutoResponse` (linha ~3943): **pular envio** quando `source === 'BLUECHAT'`
- Retornar `responseText` (conteudo da resposta gerada) no JSON de resposta para que o `bluechat-inbound` possa montar o `BlueChatResponse`

### Etapa 3: Melhorar resposta do `bluechat-inbound`

**`bluechat-inbound/index.ts`**:
- Usar o `responseText` retornado pelo `sdr-ia-interpret` para montar `response.text` na `BlueChatResponse`
- Mapear `acao: 'ESCALAR_HUMANO'` para `action: 'ESCALATE'` com `escalation.needed: true`
- Mapear `deve_responder: true` + texto para `action: 'RESPOND'`
- Mapear `deve_responder: false` para `action: 'QUALIFY_ONLY'`

### Etapa 4: Persistir `conversation_id` do ChatBlue

- Salvar `conversation_id` em `lead_messages.detalhes` ou campo dedicado para permitir uso futuro da API do ChatBlue (enviar mensagens async, transferir tickets, etc.)

### Etapa 5: Fallback assincrono (timeout 30s)

- Adicionar tratamento para quando o processamento demora mais que ~25s
- Se ultrapassar, retornar `action: 'QUALIFY_ONLY'` imediatamente e usar a API do ChatBlue (`POST /api/external-ai/messages`) para enviar a resposta depois
- Requer secret `BLUECHAT_API_KEY` para chamar a API do ChatBlue

### Etapa 6: Integracao com API do ChatBlue (opcional, recomendado)

- Criar helper para chamar a API `https://chat.grupoblue.com.br/api/external-ai`
- Endpoints uteis:
  - `POST /messages` - envio assincrono de mensagens (fallback de timeout)
  - `POST /tickets/:id/transfer` - transferencia programatica para closer
  - `GET /tickets/:id/messages` - enriquecer historico com mensagens do ChatBlue

---

## Detalhes Tecnicos

### Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/bluechat-inbound/index.ts` | Adicionar `source` ao tipo, passar para sdr-ia-interpret, melhorar resposta HTTP, persistir conversation_id |
| `supabase/functions/sdr-ia-interpret/index.ts` | Receber `source`, pular `whatsapp-send` quando `source === 'BLUECHAT'`, retornar `responseText` no JSON |

### Fluxo Correto Apos Mudancas

```text
Cliente (WhatsApp)
    |
    v
ChatBlue (recebe mensagem, identifica ticket IA)
    |
    v  POST /bluechat-inbound (source=BLUECHAT)
    |
bluechat-inbound
    |-- Identifica/cria lead
    |-- Salva mensagem (com conversation_id)
    |-- Chama sdr-ia-interpret (messageId + source=BLUECHAT)
    |       |
    |       |-- Interpreta com IA
    |       |-- NAO chama whatsapp-send (source=BLUECHAT)
    |       |-- Retorna { responseText, intent, confidence, acao, ... }
    |       |
    |-- Monta BlueChatResponse com response.text
    |-- Retorna HTTP 200
    |
    v
ChatBlue (recebe resposta, envia ao cliente via WhatsApp)
```

### Secret necessario

- `BLUECHAT_API_KEY` - para usar a API do ChatBlue (fallback assincrono e transferencia de tickets)

### Prioridades

1. **CRITICO**: Corrigir mensagem duplicada (etapas 1-3)
2. **IMPORTANTE**: Persistir conversation_id (etapa 4)
3. **RECOMENDADO**: Fallback assincrono (etapa 5)
4. **BONUS**: Integracao API ChatBlue (etapa 6)
