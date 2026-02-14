
-- View: analytics_esforco_vendedor
-- Analisa esforço (atividades) em deals perdidos por vendedor
CREATE OR REPLACE VIEW public.analytics_esforco_vendedor
WITH (security_invoker = true)
AS
SELECT
  pr.id AS user_id,
  pr.nome AS vendedor_nome,
  pip.empresa::text AS empresa,
  COUNT(d.id)::int AS total_perdidos,
  ROUND(AVG(COALESCE(ativ.cnt, 0)), 1) AS media_atividades,
  ROUND(
    (COUNT(d.id) FILTER (WHERE COALESCE(ativ.cnt, 0) = 0))::numeric
    / NULLIF(COUNT(d.id), 0) * 100, 1
  ) AS sem_atividade_pct,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (COALESCE(d.fechado_em, d.updated_at) - d.created_at)) / 86400
  )::numeric, 1) AS media_dias_funil,
  COUNT(d.id) FILTER (
    WHERE EXTRACT(EPOCH FROM (COALESCE(d.fechado_em, d.updated_at) - d.created_at)) < 86400
  )::int AS perdidos_menos_24h
FROM deals d
JOIN pipelines pip ON d.pipeline_id = pip.id
JOIN profiles pr ON d.owner_id = pr.id
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS cnt
  FROM deal_activities da
  WHERE da.deal_id = d.id
) ativ ON true
WHERE d.status = 'PERDIDO'
GROUP BY pr.id, pr.nome, pip.empresa;

-- View: analytics_canal_esforco
-- Analisa esforço em deals por canal de origem
CREATE OR REPLACE VIEW public.analytics_canal_esforco
WITH (security_invoker = true)
AS
SELECT
  COALESCE(ct.canal_origem, 'Desconhecido') AS canal,
  pip.empresa::text AS empresa,
  d.pipeline_id,
  COUNT(d.id)::int AS total_deals,
  COUNT(d.id) FILTER (WHERE d.status = 'GANHO')::int AS deals_ganhos,
  COUNT(d.id) FILTER (WHERE d.status = 'PERDIDO')::int AS deals_perdidos,
  COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'GANHO'), 0) AS valor_ganho,
  ROUND(
    (COUNT(d.id) FILTER (WHERE d.status = 'GANHO'))::numeric
    / NULLIF(COUNT(d.id) FILTER (WHERE d.status IN ('GANHO','PERDIDO')), 0) * 100, 1
  ) AS win_rate,
  ROUND(AVG(COALESCE(ativ.cnt, 0)) FILTER (WHERE d.status = 'PERDIDO'), 1) AS media_atividades_perdidos,
  ROUND(
    (COUNT(d.id) FILTER (WHERE d.status = 'PERDIDO' AND COALESCE(ativ.cnt, 0) = 0))::numeric
    / NULLIF(COUNT(d.id) FILTER (WHERE d.status = 'PERDIDO'), 0) * 100, 1
  ) AS sem_atividade_pct,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (COALESCE(d.fechado_em, d.updated_at) - d.created_at)) / 86400
  ) FILTER (WHERE d.status = 'PERDIDO')::numeric, 1) AS media_dias_funil_perdidos
FROM deals d
JOIN pipelines pip ON d.pipeline_id = pip.id
LEFT JOIN contacts ct ON d.contact_id = ct.id
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS cnt
  FROM deal_activities da
  WHERE da.deal_id = d.id
) ativ ON true
WHERE d.status IN ('GANHO', 'PERDIDO')
GROUP BY COALESCE(ct.canal_origem, 'Desconhecido'), pip.empresa, d.pipeline_id;
