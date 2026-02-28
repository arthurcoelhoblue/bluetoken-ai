

# Bug: Envio em massa falha — coluna `pipeline_empresa` não existe em `deals`

## Causa raiz

No edge function `amelia-mass-action/index.ts`, as queries filtram deals usando `.eq('pipeline_empresa', jobEmpresa)` (linhas 73 e 113), mas a tabela `deals` **não possui** essa coluna. A query retorna 0 resultados e o job vai para `FAILED` com `messages_preview: []`.

Isso afeta tanto a branch de **geração** (GENERATE) quanto a de **execução** (EXECUTE).

## Correção em `supabase/functions/amelia-mass-action/index.ts`

### 1. Branch GENERATE (linha 112-113)
Substituir a query que usa `pipeline_empresa` por uma que filtra via JOIN com pipelines:

```typescript
// Buscar deals e filtrar por tenant via pipeline
const { data: allDeals } = await supabase
  .from('deals')
  .select('id, titulo, valor, temperatura, status, pipeline_id, contacts(id, nome, telefone, email)')
  .in('id', dealIds);

// Filtrar apenas deals cuja pipeline pertence à empresa
const { data: pipelines } = await supabase
  .from('pipelines')
  .select('id')
  .eq('empresa', jobEmpresa);

const pipelineIds = new Set((pipelines || []).map(p => p.id));
const deals = (allDeals || []).filter(d => pipelineIds.has(d.pipeline_id));
```

### 2. Branch EXECUTE (linha ~73)
Mesma correção — substituir `.eq('pipeline_empresa', jobEmpresa)` pela mesma abordagem de filtrar via pipeline.

### 3. Resultado esperado
- A geração de mensagens encontra os deals corretamente
- O job passa de PENDING → GENERATING → PREVIEW com as mensagens geradas
- A execução envia as mensagens aprovadas

