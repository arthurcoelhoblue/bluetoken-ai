

## Segmento Mautic por Funil

### Problema
Atualmente o `segment_id` é único por empresa. Leads da mesma empresa podem entrar por pipelines diferentes e precisam ir para segmentos Mautic distintos.

### Solução
Trocar a coluna `segment_id` (TEXT) por `segment_ids` (JSONB) que mapeia `pipeline_id → segment_id`.

Exemplo: `{"5bbac98b-...": "3", "26de333a-...": "7"}`

### Mudanças

| Arquivo | Ação |
|---|---|
| Migration SQL | Renomear `segment_id` → `segment_ids` (JSONB), migrar dados existentes |
| `MauticConfigManager.tsx` | Substituir campo único por lista editável de pares `Funil → Segment ID`, com dropdown dos pipelines da empresa |
| `lp-lead-ingest/index.ts` | `getMauticConfig` retorna `segmentIds` (mapa). Na hora do push, resolver segment pelo `pipeline_id` do deal |

### Database Migration
```sql
ALTER TABLE mautic_company_config 
  ADD COLUMN segment_ids JSONB DEFAULT '{}';

UPDATE mautic_company_config 
  SET segment_ids = jsonb_build_object('default', segment_id)
  WHERE segment_id IS NOT NULL;

ALTER TABLE mautic_company_config 
  DROP COLUMN segment_id;
```

### UI — MauticConfigManager
- Carregar pipelines da empresa via query `pipelines` filtrado por `empresa = emp.id`
- Renderizar lista de pares: Select de pipeline + Input de segment ID + botão remover
- Botão "Adicionar segmento"
- Form state: `segment_ids: Array<{ pipeline_id: string; segment_id: string }>`

### Edge function — lp-lead-ingest
```typescript
// getMauticConfig retorna segmentIds: Record<string, string>
segmentIds: data.segment_ids || {}

// pushToMautic recebe pipelineId extra
const segmentId = mauticCfg.segmentIds[pipelineId] || mauticCfg.segmentIds['default'];
if (contactId && segmentId) {
  // add to segment
}
```

