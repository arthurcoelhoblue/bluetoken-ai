

## Corrigir nome do remetente em mensagens manuais via Blue Chat

### Problema

Quando o vendedor assume o atendimento e envia uma mensagem manual, ela chega no Blue Chat com `source: "AMELIA_SDR"`, fazendo com que o Blue Chat identifique a mensagem como vinda da Amelia em vez do vendedor logado (Arthur).

### Causa raiz

Dois pontos precisam ser corrigidos:

1. **`bluechat-proxy/index.ts`** (edge function): O campo `source` esta hardcoded como `"AMELIA_SDR"` e nenhum nome de remetente e enviado no payload
2. **`useConversationMode.ts`** (frontend): O hook `useSendManualMessage` nao envia o nome do usuario logado no body da requisicao

### Solucao

#### 1. Frontend: `src/hooks/useConversationMode.ts`

Incluir o nome do usuario logado no payload enviado ao `bluechat-proxy`:

```typescript
// Linha ~127: adicionar sender_name ao body
const { data, error } = await supabase.functions.invoke('bluechat-proxy', {
  body: {
    action: 'send-message',
    empresa,
    conversation_id: bluechatConversationId,
    phone: telefone.replace(/\D/g, ''),
    content: conteudo,
    sender_name: user?.user_metadata?.nome || user?.user_metadata?.full_name || 'Vendedor',
  },
});
```

#### 2. Edge Function: `supabase/functions/bluechat-proxy/index.ts`

No bloco `send-message`, receber `sender_name` do body e:
- Mudar o `source` de `"AMELIA_SDR"` para `"MANUAL"` (ou outro identificador) quando um nome humano e fornecido
- Incluir `senderName` no payload enviado ao Blue Chat

```typescript
// Linha ~196: extrair sender_name do body
const { conversation_id, content, phone, sender_name } = body as { ... };

// Linha ~205: ajustar payload
body: JSON.stringify({
  content,
  type: "TEXT",
  source: sender_name ? "MANUAL" : "AMELIA_SDR",
  senderName: sender_name || "Amélia",
  ...(conversation_id ? { ticketId: conversation_id } : {}),
  ...(phone ? { phone } : {}),
}),
```

### Arquivos alterados

- `src/hooks/useConversationMode.ts` -- incluir `sender_name` no payload
- `supabase/functions/bluechat-proxy/index.ts` -- receber e repassar `sender_name` ao Blue Chat, ajustar `source`

### Impacto

- Mensagens manuais passam a exibir o nome do vendedor no Blue Chat
- Mensagens automaticas da Amelia continuam com `source: "AMELIA_SDR"` (sem regressao)
- Nenhuma mudanca de banco necessaria

