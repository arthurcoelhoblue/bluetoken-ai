

# Isolamento Multi-Tenant em Batch Mode -- forEachEmpresa

---

## Problema

Quatro funcoes processam TODOS os registros sem filtro de empresa quando chamadas em batch (CRON):

| Funcao | Linha problematica | O que faz |
|--------|-------------------|-----------|
| `deal-scoring` | L54-65 | Sem `empresa` no body, busca TODOS os deals abertos |
| `cs-health-calculator` | L39-41 | Sem `customer_id`, busca TODOS os cs_customers ativos |
| `cs-ai-actions/churn-predict` | L55-58 | Busca TODOS os cs_customers ativos sem filtro |
| `cs-ai-actions/detect-incidents` | L123-124 | Busca TODOS os cs_customers ativos sem filtro |

## Solucao

Aplicar o mesmo padrao `forEachEmpresa` que `cs-scheduled-jobs/trending-topics` ja usa (linhas 194-228): iterar `for (const empresa of EMPRESAS)` e filtrar cada query por empresa.

---

## Mudancas por Arquivo

### 1. `supabase/functions/deal-scoring/index.ts`

Importar `EMPRESAS` ou definir localmente. No batch mode (sem `deal_id` e sem `empresa`), iterar por empresa:

```typescript
// Antes (L54-65):
if (!empresa) { query = query.limit(200); }

// Depois:
if (!targetDealId && !empresa) {
  // forEachEmpresa
  const allResults = [];
  for (const emp of ['BLUE', 'TOKENIZA']) {
    const { data: pipelines } = await supabase.from('pipelines').select('id').eq('empresa', emp);
    // ... processar deals desse tenant
  }
  return response;
}
```

### 2. `supabase/functions/cs-health-calculator/index.ts`

No batch mode (sem `customer_id`), iterar por empresa:

```typescript
// Antes (L39-41):
const { data } = await supabase.from('cs_customers').select('id').eq('is_active', true);

// Depois:
for (const empresa of EMPRESAS) {
  const { data } = await supabase.from('cs_customers')
    .select('id').eq('is_active', true).eq('empresa', empresa);
  // processar por tenant
}
```

### 3. `supabase/functions/cs-ai-actions/index.ts` -- churn-predict

```typescript
// Antes (L55-58):
const { data: customers } = await supabase.from('cs_customers')
  .select('...').eq('is_active', true);

// Depois:
for (const empresa of EMPRESAS) {
  const { data: customers } = await supabase.from('cs_customers')
    .select('...').eq('is_active', true).eq('empresa', empresa);
  // processar por tenant
}
```

### 4. `supabase/functions/cs-ai-actions/index.ts` -- detect-incidents

```typescript
// Antes (L123-124):
const { data: customers } = await supabase.from('cs_customers')
  .select('...').eq('is_active', true);

// Depois:
for (const empresa of EMPRESAS) {
  const { data: customers } = await supabase.from('cs_customers')
    .select('...').eq('is_active', true).eq('empresa', empresa);
  // processar por tenant
}
```

---

## Resumo

| Arquivo | Tipo de mudanca |
|---------|----------------|
| `supabase/functions/deal-scoring/index.ts` | Adicionar loop forEachEmpresa no batch mode |
| `supabase/functions/cs-health-calculator/index.ts` | Adicionar loop forEachEmpresa no batch mode |
| `supabase/functions/cs-ai-actions/index.ts` | Adicionar .eq('empresa') em churn-predict e detect-incidents |

Total: 3 arquivos editados. Zero impacto no modo single (deal_id/customer_id), que continua funcionando igual.

