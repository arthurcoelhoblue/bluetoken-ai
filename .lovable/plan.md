

## Lembrar ultimo pipeline selecionado por empresa

### Problema
Ao abrir a pagina Pipeline, o sistema sempre seleciona o pipeline padrao (ou o primeiro). O usuario perde o contexto de qual pipeline estava visualizando.

### Solucao
Salvar o pipeline selecionado no `localStorage` por empresa. Ao carregar a pagina, restaurar a ultima selecao. Ao trocar de empresa, limpar e usar o padrao normalmente.

### Arquivo alterado

**`src/pages/PipelinePage.tsx`**

1. Criar chave de storage: `bluecrm-last-pipeline-<empresa>` (usando `activeCompany`)
2. No `useEffect` que reage a `pipelines` (linhas 90-97):
   - Antes de usar o default, verificar se existe um pipeline salvo no localStorage para a empresa ativa
   - Se o pipeline salvo existir na lista de pipelines disponiveis, usa-lo
   - Caso contrario, manter o comportamento atual (default ou primeiro)
3. No handler `onPipelineChange` (que hoje e `setSelectedPipelineId`):
   - Alem de atualizar o state, salvar o id no localStorage com a chave da empresa
4. No `useEffect` de troca de empresa (linhas 99-103):
   - Ao trocar empresa, tentar restaurar o pipeline salvo para a nova empresa

### Detalhe tecnico

```typescript
const PIPELINE_STORAGE_PREFIX = 'bluecrm-last-pipeline-';

// Handler de selecao
const handlePipelineChange = (id: string) => {
  setSelectedPipelineId(id);
  localStorage.setItem(`${PIPELINE_STORAGE_PREFIX}${activeCompany}`, id);
};

// useEffect de pipelines carregados
useEffect(() => {
  if (pipelines && pipelines.length > 0) {
    const savedId = localStorage.getItem(`${PIPELINE_STORAGE_PREFIX}${activeCompany}`);
    const savedPipeline = savedId ? pipelines.find(p => p.id === savedId) : null;
    const fallback = pipelines.find(p => p.is_default) ?? pipelines[0];
    setSelectedPipelineId(savedPipeline?.id ?? fallback.id);
  } else {
    setSelectedPipelineId(null);
  }
}, [pipelines]);

// useEffect de troca de empresa -- mesmo comportamento, pois pipelines recarrega
```

Mudanca localizada em `PipelinePage.tsx`, sem impacto em outros arquivos. O `onPipelineChange` passado ao `PipelineFilters` muda de `setSelectedPipelineId` para `handlePipelineChange`.

