

# Clonar pipeline existente ao criar um novo

## O que muda

No dialog "Novo Pipeline", adicionar um campo opcional **"Clonar de"** com um dropdown listando os pipelines existentes. Quando selecionado, o novo pipeline sera criado com todas as stages copiadas do pipeline de origem (nomes, cores, SLA, posicoes, flags won/lost).

## Como funciona

1. O usuario clica em "Novo Funil"
2. Preenche nome, empresa e tipo normalmente
3. Opcionalmente seleciona um pipeline existente no campo "Clonar de"
4. Ao clicar "Criar":
   - Se nenhum clone selecionado: cria pipeline vazio (comportamento atual)
   - Se clone selecionado: usa o hook `useDuplicatePipeline` que ja existe no codigo para copiar pipeline + stages

## Detalhes tecnicos

### Arquivo: `src/pages/PipelineConfigPage.tsx`

- Adicionar estado `cloneFromId` (string | null)
- Adicionar `<Select>` opcional "Clonar de" no dialog, listando `pipelines` existentes com nome + empresa
- No `handleCreatePipeline`:
  - Se `cloneFromId` preenchido, chamar `duplicatePipeline.mutateAsync({ sourceId: cloneFromId, newName, newEmpresa })`
  - Senao, manter fluxo atual com `createPipeline.mutateAsync`
- Importar `useDuplicatePipeline` do hook existente

### Arquivo: `src/hooks/usePipelineConfig.ts`

- Ajustar `useDuplicatePipeline` para tambem copiar o campo `tipo` do pipeline de origem (atualmente so copia `descricao`)

### Arquivo: `src/types/customFields.ts`

- Nenhuma alteracao necessaria, `PipelineFormData` ja tem campo `tipo`

