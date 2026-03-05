

## Problema Confirmado

Dados do banco:
- `contacts.owner_id` = **NULL** para Arthur Coelho
- `deals.owner_id` = `3eb15a6a` (Arthur Coelho, arthur@tokeniza.com.br) — existe e está correto
- Todas as 5 notificações recentes: `closer_email = closer@grupoblue.com.br`

O código busca apenas `contacts.owner_id`. Quando é NULL, tenta round-robin com `profiles!inner(is_vendedor, is_active)` — essa sintaxe de JOIN no Supabase JS client falha silenciosamente, retornando array vazio. Resultado: `notify_user_id` nunca é preenchido.

## Solução

### `action-executor.ts` — Duas correções

**1. Fallback para `deals.owner_id` quando `contacts.owner_id` é NULL**

Tanto em `ESCALAR_HUMANO` quanto em `CRIAR_TAREFA_CLOSER`, após verificar `contacts.owner_id`, buscar o owner do deal associado:

```ts
// Após: tarefaNotifyUserId = tarefaContact?.owner_id
if (!tarefaNotifyUserId && tarefaContact?.id) {
  const { data: dealWithOwner } = await supabase
    .from('deals').select('owner_id')
    .eq('contact_id', tarefaContact.id)
    .eq('status', 'ABERTO')
    .order('updated_at', { ascending: false })
    .limit(1).maybeSingle();
  if (dealWithOwner?.owner_id) {
    tarefaNotifyUserId = dealWithOwner.owner_id;
  }
}
```

**2. Round-robin robusto (sem `profiles!inner`)**

Substituir a query que usa `profiles!inner(...)` por duas queries separadas:

```ts
// Em vez de: .select('user_id, profiles!inner(is_vendedor, is_active)')
const { data: assignments } = await supabase
  .from('user_access_assignments')
  .select('user_id')
  .eq('empresa', empresa);
if (assignments?.length) {
  const userIds = assignments.map(a => a.user_id);
  const { data: activeVendors } = await supabase
    .from('profiles')
    .select('id')
    .in('id', userIds)
    .eq('is_vendedor', true)
    .eq('is_active', true);
  // ... round-robin com activeVendors
}
```

### Resumo

| Local | Mudança |
|-------|---------|
| `ESCALAR_HUMANO` (linha 83-107) | Adicionar fallback `deals.owner_id` + fix round-robin |
| `CRIAR_TAREFA_CLOSER` (linha 190-219) | Adicionar fallback `deals.owner_id` + fix round-robin |

Ambas as ações passam pelo mesmo padrão: contacts.owner_id → deals.owner_id → round-robin robusto.

