

## Diagnóstico — Três Problemas

### 1. Rota `/deals` não existe → 404

O `LinkedDealsPopover` (usado na tela de conversas) navega para `/deals?pipeline=...&deal=...`, mas **não existe rota `/deals`** no `App.tsx`. A rota correta é `/pipeline`. O console confirma o 404.

**Correção**: Em `LinkedDealsPopover.tsx` linha 45, trocar `/deals` por `/pipeline`:
```tsx
onClick={() => navigate(`/pipeline?pipeline=${deal.pipeline_id}&deal=${deal.id}`)}
```

### 2. Escalação muda para MANUAL imediatamente — deveria manter SDR_IA até o vendedor assumir

Atualmente, na linha 65 de `action-executor.ts`, ao escalar a IA muda o modo para `MANUAL` instantaneamente:
```ts
await supabase.from('lead_conversation_state').update({ modo: 'MANUAL', ... })
```

Isso silencia a Amélia antes do vendedor assumir. O comportamento correto é:
- **Manter `modo: 'SDR_IA'`** durante a escalação
- Marcar um flag `escalado_para` com o `user_id` do vendedor designado
- A Amélia continua respondendo normalmente enquanto o vendedor não assume
- Quando o vendedor clica "Assumir atendimento", aí sim muda para `MANUAL`

**Correção em `action-executor.ts`** (ESCALAR_HUMANO, linha 65):
- Em vez de `modo: 'MANUAL'`, fazer `update({ escalado_para: notifyUserId, updated_at: now })` sem mudar o modo
- Será necessário adicionar coluna `escalado_para UUID` na tabela `lead_conversation_state` via migration

A lógica de takeover no hook `useConversationTakeover` já funciona corretamente — quando o vendedor clica "Assumir", ele muda o modo para MANUAL.

### 3. E-mail da escalação vai para `closer_email` genérico — deveria ir para o e-mail do vendedor designado

O `notify-closer` busca um `closer_email` de `system_settings` ou usa fallback genérico. Deveria enviar para o **e-mail do vendedor** que foi designado (`notify_user_id`).

**Correção em `notify-closer/index.ts`**:
- Quando `notify_user_id` está presente, buscar o e-mail do perfil desse usuário em `auth.users` (via service client) ou na tabela `profiles`
- Usar esse e-mail como destinatário em vez do `closer_email` genérico

### Resumo das mudanças

| Arquivo | Mudança |
|---------|---------|
| `src/components/leads/LinkedDealsPopover.tsx` | `/deals` → `/pipeline` na navegação |
| `supabase/functions/sdr-ia-interpret/action-executor.ts` | Remover `modo: 'MANUAL'` na escalação; adicionar `escalado_para` |
| `supabase/functions/notify-closer/index.ts` | Buscar e-mail do vendedor designado via `profiles` quando `notify_user_id` presente |
| **Migration SQL** | Adicionar coluna `escalado_para UUID` em `lead_conversation_state` |

