

## Diagnóstico: Copilot envia mensagem duplicada

### Causa raiz
O fluxo de streaming cria uma mensagem placeholder via `addLocalMessage` e a atualiza token-a-token via `updateLastMessage`. Quando o streaming termina, `saveMessage('assistant', ...)` salva no banco **E** adiciona uma SEGUNDA cópia na lista local de mensagens. Resultado: a mensagem aparece duplicada — uma incompleta (placeholder que para de atualizar) e outra completa.

### Bug secundário: coaching behavioral não injeta
Os logs mostram `hasCoaching: false` em todas as chamadas. O `knowledge-search` está retornando vazio, possivelmente porque a edge function é invocada internamente sem o service role correto ou a query não encontra chunks behavioral para a empresa.

---

### Correção 1: Eliminar duplicata de mensagens

**Arquivo:** `src/hooks/useCopilotMessages.ts`

Criar uma nova função `saveMessageOnly` que salva no banco SEM adicionar ao state local (porque o placeholder já está lá). Depois, substituir o placeholder pelo registro real do banco (com ID correto).

**Arquivo:** `src/components/copilot/CopilotPanel.tsx`

Alterar o fluxo pós-streaming para:
1. Salvar no banco sem duplicar no state (usar a nova função)
2. Atualizar o ID do placeholder com o ID real retornado do banco

### Correção 2: Investigar coaching behavioral

**Arquivo:** `supabase/functions/copilot-chat/index.ts`

Trocar `supabase.functions.invoke('knowledge-search')` por uma chamada HTTP direta com `Authorization: Bearer <service_role_key>`, pois `functions.invoke` dentro de outra edge function pode não resolver corretamente.

---

| Arquivo | Mudança |
|---|---|
| `src/hooks/useCopilotMessages.ts` | Adicionar `saveMessageQuiet` que persiste no DB sem duplicar no state |
| `src/components/copilot/CopilotPanel.tsx` | Usar `saveMessageQuiet` após streaming para evitar duplicata |
| `supabase/functions/copilot-chat/index.ts` | Usar fetch HTTP direto para knowledge-search em vez de functions.invoke |

