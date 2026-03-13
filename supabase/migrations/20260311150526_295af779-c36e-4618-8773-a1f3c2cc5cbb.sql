
-- Backfill: create CRIACAO activities for legacy deals that have metadata.campos_extras but no FORMULARIO activity
INSERT INTO deal_activities (deal_id, tipo, descricao, metadata, created_at)
SELECT
  d.id,
  'CRIACAO',
  'Lead via ' || COALESCE(d.canal_origem, 'formulário'),
  jsonb_build_object(
    'origem', 'FORMULARIO',
    'canal_origem', d.canal_origem,
    'campos_preenchidos', d.metadata->'campos_extras',
    'utm_source', d.metadata->>'utm_source',
    'utm_medium', d.metadata->>'utm_medium',
    'utm_campaign', d.metadata->>'utm_campaign',
    'backfilled', true
  ),
  d.created_at
FROM deals d
WHERE d.metadata->>'campos_extras' IS NOT NULL
  AND d.metadata->'campos_extras' IS NOT NULL
  AND jsonb_typeof(d.metadata->'campos_extras') = 'object'
  AND NOT EXISTS (
    SELECT 1 FROM deal_activities da
    WHERE da.deal_id = d.id
      AND da.tipo = 'CRIACAO'
      AND da.metadata->>'origem' = 'FORMULARIO'
  );
