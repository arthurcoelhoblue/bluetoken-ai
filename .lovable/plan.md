

# Corrigir extração da mensagem atual no payload adapter do Blue Chat

## Problema

O Blue Chat envia dois campos no payload:
- `message.content` -- a mensagem que o lead acabou de enviar (a atual)
- `conversation[]` -- o historico completo da conversa (mensagens antigas)

O adaptador atual (`payload-adapter.ts`) ignora o campo `message` e extrai a ultima mensagem do array `conversation`. Isso faz com que a Amelia receba uma mensagem antiga em vez da mensagem que o lead realmente enviou.

Exemplo concreto dos logs:
- Lead enviou: **"Amelia"** (campo `message.content`)
- Amelia recebeu: **"Sim, quero falar com comercial"** (ultima mensagem de customer no `conversation[]`)

## Causa raiz

A interface `BlueChatNativePayload` nao inclui o campo `message` (separado do `conversation`). A funcao `adaptNativePayload` usa apenas `extractLastCustomerMessage(conversation)` para definir o texto da mensagem.

## Correcao

### Arquivo: `supabase/functions/bluechat-inbound/payload-adapter.ts`

1. Adicionar o campo `message` na interface `BlueChatNativePayload`:

```typescript
interface BlueChatNativePayload {
  event: string;
  timestamp: string;
  ticket: { ... };
  contact: { ... };
  message?: {
    id?: string;
    content?: string;
    type?: string;
    mediaUrl?: string | null;
    timestamp?: string;
  };
  conversation?: Array<{ ... }>;
  summary?: string;
  instruction?: string;
}
```

2. Na funcao `adaptNativePayload`, priorizar `native.message.content` sobre o historico do `conversation`:

```typescript
// Prioridade: message.content (mensagem atual) > conversation (historico)
const lastMessage = (native.message?.content?.trim())
  ? native.message.content.trim()
  : extractLastCustomerMessage(native.conversation, native.summary, native.instruction);
```

3. Usar o `message.id` nativo como `message_id` quando disponivel (em vez do ID sintetico baseado em timestamp):

```typescript
message_id: native.message?.id
  ? `bc-${native.message.id}`
  : `bc-${native.ticket.id}-${Date.now()}`,
```

## Resultado esperado

A Amelia vai receber a mensagem que o lead realmente enviou, em vez de uma mensagem antiga do historico. O historico continua disponivel no campo `context.history_summary` para dar contexto a IA.

## Arquivo alterado

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/bluechat-inbound/payload-adapter.ts` | Priorizar `message.content` sobre `conversation[]` para extrair mensagem atual |

