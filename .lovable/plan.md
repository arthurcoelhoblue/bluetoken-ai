

## Diagnóstico - Conversa Arthur Coelho (BLUE)

Identifiquei **3 problemas distintos** analisando os logs e dados do banco:

### Problema 1: Agendamento de reunião falha - `No owner_id`

Os logs mostram claramente:
```
WARN meeting-scheduler: "No owner_id for meeting scheduling"
```

**Causa raiz**: O `message-parser.ts` busca deals usando `contato.id`, mas `contato` vem da tabela `lead_contacts` (id = `e4027f53...`). Porém, `deals.contact_id` referencia a tabela `contacts` (id = `eda04b5e...`). São IDs de tabelas diferentes. A query nunca retorna deals, logo `ownerId` fica `undefined`.

O deal existe (`6fcbf4c8...`) com `owner_id = 3eb15a6a` (Arthur Coelho), mas não é encontrado.

**Correção em `message-parser.ts`**: Após carregar o `contato` (lead_contacts), buscar o `contacts.id` correspondente via `legacy_lead_id` e usar esse ID para buscar deals:

```ts
// Buscar contacts.id (deals referencia contacts, não lead_contacts)
let contactsCrmId: string | null = null;
if (contato?.id) {
  const { data: crmContact } = await supabase
    .from('contacts').select('id, owner_id')
    .eq('legacy_lead_id', leadId).maybeSingle();
  contactsCrmId = crmContact?.id || null;
}

// Buscar deals pelo contacts.id (não lead_contacts.id)
if (contactsCrmId) {
  const { data: fetchedDeals } = await supabase.from('deals')
    .select('id, titulo, valor, status, stage_id, owner_id, contact_id')
    .eq('contact_id', contactsCrmId).limit(5);
  dealsData = fetchedDeals || [];
}
```

Também atualizar `meetingCtx` no `index.ts` para usar o `contacts.id` como `contactId`.

### Problema 2: Email vai para `closer@grupoblue.com.br`

O `contacts.owner_id` é `null` para este lead. O round-robin deveria funcionar, mas o bloco inteiro está dentro de `try { ... } catch { /* ignore */ }`, e a query com `profiles!inner(is_vendedor, is_active)` pode estar falhando silenciosamente (o Supabase JS client nem sempre suporta essa sintaxe de JOIN).

**Correção em `action-executor.ts`**:
1. Adicionar log no catch para diagnosticar erros (nunca `/* ignore */`)
2. Trocar a query de round-robin para uma abordagem mais robusta — buscar user_ids das assignments e depois filtrar contra profiles separadamente
3. Garantir que `CRIAR_TAREFA_CLOSER` também crie notificação in-app (veja Problema 3)

### Problema 3: Sem notificação no sininho do vendedor

A ação `CRIAR_TAREFA_CLOSER` (linhas 185-233) **não insere nenhum registro na tabela `notifications`**. Só chama o `notify-closer` (email) e cria o deal. Diferente do `ESCALAR_HUMANO` que insere notificação in-app (linhas 124-141).

**Correção**: Adicionar inserção de notificação in-app no `CRIAR_TAREFA_CLOSER`, similar ao `ESCALAR_HUMANO`.

### Resumo de mudanças

| Arquivo | Mudança |
|---------|---------|
| `message-parser.ts` | Buscar `contacts.id` via `legacy_lead_id` para usar na query de deals (em vez de `lead_contacts.id`) |
| `index.ts` | Passar `contacts.id` como `contactId` no `meetingCtx` (não `lead_contacts.id`) |
| `action-executor.ts` | 1. Adicionar notificação in-app no `CRIAR_TAREFA_CLOSER`; 2. Logar erros no catch; 3. Tornar round-robin mais robusto |

