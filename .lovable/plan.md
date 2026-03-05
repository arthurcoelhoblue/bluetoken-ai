

## Correção: Pipeline e Estágio não salvam ao editar mapeamento Elementor

### Causa raiz

No `openEditDialog` (linha 247), os estados são definidos em sequência:
```
setNewEmpresa(mapping.empresa)
setNewPipelineId(mapping.pipeline_id)
setNewStageId(mapping.stage_id)
```

Porém existem dois `useEffect` (linhas 155-163) que **resetam** os valores:
- Quando `newEmpresa` muda → limpa `newPipelineId` e `newStageId`
- Quando `newPipelineId` muda → limpa `newStageId`

Como os effects executam **após** o render, eles sobrescrevem os valores que acabaram de ser setados no `openEditDialog`. Resultado: pipeline e estágio sempre voltam para vazio.

### Correção

Adicionar um flag `isInitializing` que bloqueia os useEffects durante a carga dos dados de edição. Quando `openEditDialog` é chamado, setar o flag antes e limpar depois. Os useEffects só resetam quando o flag é `false`.

### Arquivo afetado
- `src/components/settings/ElementorIntegrationManager.tsx`

