

## Problema Raiz

O agendamento não funciona porque o `ownerId` nunca chega ao `startMeetingScheduling`. A causa está em `message-parser.ts` linha 243:

```ts
supabase.from('deals').select('id, titulo, valor, status, stage_id')
  .eq('lead_id', leadId).limit(5)
```

**Dois erros:**
1. A tabela `deals` não tem coluna `lead_id` — o vínculo é via `contact_id` (referência à tabela `lead_contacts`). A query sempre retorna `[]`.
2. O `select` não inclui `owner_id`, que é necessário para buscar a agenda do vendedor.

Sem deals carregados, `parsedContext.deals` é sempre vazio, `meetingCtx.ownerId` é sempre `undefined`, e `startMeetingScheduling` retorna `{ handled: false }`.

## Solução

### 1. Corrigir query de deals em `message-parser.ts` (linha 243-244)

Trocar a query para buscar deals pelo `contact_id` do lead_contact, incluindo `owner_id`:

```ts
// Buscar deal via contact_id (lead_contacts.id)
supabase.from('deals').select('id, titulo, valor, status, stage_id, owner_id, contact_id')
  .eq('contact_id', contactRes.data?.id || '')
  .limit(5),
```

**Problema**: `contactRes` é resolvido no mesmo `Promise.all`. Precisamos reestruturar para primeiro buscar o contact, depois buscar deals com o `contact_id`.

Alternativa mais simples: fazer a query de deals separada, após o `Promise.all`:

```ts
// Após o Promise.all atual (que já não inclui deals)
let deals: Record<string, unknown>[] = [];
if (contato?.id) {
  const { data: dealsData } = await supabase
    .from('deals')
    .select('id, titulo, valor, status, stage_id, owner_id, contact_id')
    .eq('contact_id', contato.id)
    .limit(5);
  deals = dealsData || [];
}
```

### 2. Fallback para `owner_id` do `lead_contacts` em `index.ts` (linha 143)

Se o deal não tiver `owner_id`, usar o `owner_id` do `lead_contacts`:

```ts
ownerId: parsedContext.deals?.[0]
  ? (parsedContext.deals[0] as Record<string, unknown>).owner_id as string
  : (parsedContext.contato as Record<string, unknown>)?.owner_id as string || undefined,
```

### Resumo

| Arquivo | Mudança |
|---------|---------|
| `message-parser.ts` | Corrigir query de deals: usar `contact_id` em vez de `lead_id`; incluir `owner_id` no select; separar do `Promise.all` |
| `index.ts` | Adicionar fallback para `owner_id` do `lead_contacts` quando deal não tem owner |

