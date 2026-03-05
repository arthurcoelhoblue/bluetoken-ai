

## Problema

O email de escalação vai para `closer@grupoblue.com.br` (fallback) em vez do email do vendedor. Dois pontos causam isso:

1. **Ação `CRIAR_TAREFA_CLOSER` (linha 190)**: Chama `notify-closer` sem passar `notify_user_id`. Sem esse campo, o `notify-closer` cai direto no fallback `closer@...`.

2. **Round-robin no `ESCALAR_HUMANO`**: Busca vendedores em `user_access_assignments` sem filtrar por `is_vendedor = true` na tabela `profiles`. Pode pegar admins ou outros usuários.

Confirmação nos dados: a maioria dos `closer_notifications` recentes tem `closer_email = closer@grupoblue.com.br`, confirmando que o `notify_user_id` não está chegando.

## Solução

### `supabase/functions/sdr-ia-interpret/action-executor.ts`

**1. Corrigir `CRIAR_TAREFA_CLOSER` (linhas 188-199)**

Adicionar busca do owner do contato e round-robin (mesma lógica do `ESCALAR_HUMANO`) antes de chamar `notify-closer`, passando `notify_user_id`:

```ts
case 'CRIAR_TAREFA_CLOSER':
  if (runId) { ... }
  if (leadId) {
    // Buscar owner do contato
    const { data: tarefaContact } = await supabase
      .from('contacts').select('id, owner_id')
      .eq('legacy_lead_id', leadId).maybeSingle();
    let tarefaNotifyUserId = tarefaContact?.owner_id;

    // Round-robin se sem owner (filtrando is_vendedor)
    if (!tarefaNotifyUserId) {
      // ... mesma lógica de round-robin ...
    }

    await fetch(notify-closer, {
      body: { lead_id, empresa, motivo, notify_user_id: tarefaNotifyUserId }
    });
  }
```

**2. Filtrar round-robin por `is_vendedor` (linha 88-91)**

Trocar a query para fazer JOIN com `profiles` e filtrar apenas vendedores ativos:

```ts
const { data: sellers } = await supabase
  .from('user_access_assignments')
  .select('user_id, profiles!inner(is_vendedor, is_active)')
  .eq('empresa', empresa)
  .eq('profiles.is_vendedor', true)
  .eq('profiles.is_active', true);
```

### Resumo

| Local | Mudança |
|-------|---------|
| `CRIAR_TAREFA_CLOSER` (linha 188) | Buscar owner do contato + round-robin, passar `notify_user_id` |
| Round-robin (linha 88) | Filtrar por `is_vendedor = true` e `is_active = true` |

