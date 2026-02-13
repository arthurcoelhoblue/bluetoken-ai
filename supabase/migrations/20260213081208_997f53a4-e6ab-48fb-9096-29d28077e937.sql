
-- View 1: analytics_funnel
CREATE OR REPLACE VIEW public.analytics_funnel WITH (security_invoker = true) AS
SELECT
  ps.id AS stage_id,
  ps.nome AS stage_nome,
  ps.posicao,
  ps.pipeline_id,
  p.nome AS pipeline_nome,
  p.empresa,
  COUNT(d.id) FILTER (WHERE d.status = 'aberto') AS deals_ativos,
  COUNT(d.id) AS deals_count,
  COALESCE(SUM(d.valor), 0) AS deals_valor,
  COALESCE(
    AVG(dsh.tempo_no_stage_anterior_ms / 60000.0) FILTER (WHERE dsh.tempo_no_stage_anterior_ms IS NOT NULL),
    0
  ) AS tempo_medio_min
FROM pipeline_stages ps
JOIN pipelines p ON p.id = ps.pipeline_id
LEFT JOIN deals d ON d.stage_id = ps.id
LEFT JOIN deal_stage_history dsh ON dsh.deal_id = d.id AND dsh.to_stage_id = ps.id
WHERE p.ativo = true
GROUP BY ps.id, ps.nome, ps.posicao, ps.pipeline_id, p.nome, p.empresa
ORDER BY ps.pipeline_id, ps.posicao;

-- View 2: analytics_conversion
CREATE OR REPLACE VIEW public.analytics_conversion WITH (security_invoker = true) AS
SELECT
  p.id AS pipeline_id,
  p.nome AS pipeline_nome,
  p.empresa,
  COUNT(d.id) AS total_deals,
  COUNT(d.id) FILTER (WHERE d.status = 'ganho') AS deals_ganhos,
  COUNT(d.id) FILTER (WHERE d.status = 'perdido') AS deals_perdidos,
  COUNT(d.id) FILTER (WHERE d.status = 'aberto') AS deals_abertos,
  COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'ganho'), 0) AS valor_ganho,
  COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'aberto'), 0) AS valor_pipeline_aberto,
  CASE WHEN COUNT(d.id) FILTER (WHERE d.status IN ('ganho','perdido')) > 0
    THEN ROUND(COUNT(d.id) FILTER (WHERE d.status = 'ganho')::numeric / COUNT(d.id) FILTER (WHERE d.status IN ('ganho','perdido'))::numeric * 100, 1)
    ELSE 0 END AS win_rate,
  CASE WHEN COUNT(d.id) FILTER (WHERE d.status = 'ganho') > 0
    THEN ROUND(SUM(d.valor) FILTER (WHERE d.status = 'ganho')::numeric / COUNT(d.id) FILTER (WHERE d.status = 'ganho')::numeric, 2)
    ELSE 0 END AS ticket_medio_ganho,
  CASE WHEN COUNT(d.id) FILTER (WHERE d.status = 'ganho' AND d.data_ganho IS NOT NULL) > 0
    THEN ROUND(AVG(EXTRACT(EPOCH FROM (d.data_ganho::timestamp - d.created_at::timestamp)) / 86400.0) FILTER (WHERE d.status = 'ganho' AND d.data_ganho IS NOT NULL)::numeric, 1)
    ELSE 0 END AS ciclo_medio_dias
FROM pipelines p
LEFT JOIN deals d ON d.pipeline_id = p.id
WHERE p.ativo = true
GROUP BY p.id, p.nome, p.empresa;

-- View 3: analytics_vendedor (fixed: profiles.is_active not ativo)
CREATE OR REPLACE VIEW public.analytics_vendedor WITH (security_invoker = true) AS
SELECT
  pr.id AS user_id,
  pr.nome AS vendedor_nome,
  pip.empresa,
  COUNT(d.id) AS total_deals,
  COUNT(d.id) FILTER (WHERE d.status = 'ganho') AS deals_ganhos,
  COUNT(d.id) FILTER (WHERE d.status = 'perdido') AS deals_perdidos,
  COUNT(d.id) FILTER (WHERE d.status = 'aberto') AS deals_abertos,
  COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'ganho'), 0) AS valor_ganho,
  CASE WHEN COUNT(d.id) FILTER (WHERE d.status IN ('ganho','perdido')) > 0
    THEN ROUND(COUNT(d.id) FILTER (WHERE d.status = 'ganho')::numeric / COUNT(d.id) FILTER (WHERE d.status IN ('ganho','perdido'))::numeric * 100, 1)
    ELSE 0 END AS win_rate,
  (SELECT COUNT(*) FROM deal_activities da WHERE da.user_id = pr.id AND da.created_at >= NOW() - INTERVAL '7 days') AS atividades_7d
FROM profiles pr
JOIN deals d ON d.owner_id = pr.id
JOIN pipelines pip ON pip.id = d.pipeline_id
WHERE pr.is_active = true
GROUP BY pr.id, pr.nome, pip.empresa;

-- View 4: analytics_deals_periodo
CREATE OR REPLACE VIEW public.analytics_deals_periodo WITH (security_invoker = true) AS
SELECT
  DATE_TRUNC('month', d.created_at)::date AS mes,
  pip.empresa,
  d.pipeline_id,
  COUNT(d.id) AS total_deals,
  COUNT(d.id) FILTER (WHERE d.status = 'ganho') AS deals_ganhos,
  COUNT(d.id) FILTER (WHERE d.status = 'perdido') AS deals_perdidos,
  COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'ganho'), 0) AS valor_ganho,
  COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'perdido'), 0) AS valor_perdido
FROM deals d
JOIN pipelines pip ON pip.id = d.pipeline_id
GROUP BY mes, pip.empresa, d.pipeline_id
ORDER BY mes DESC;

-- View 5: analytics_motivos_perda
CREATE OR REPLACE VIEW public.analytics_motivos_perda WITH (security_invoker = true) AS
SELECT
  COALESCE(d.motivo_perda_final, d.motivo_perda, 'Não informado') AS motivo,
  COALESCE(d.categoria_perda_final, d.categoria_perda_ia, 'sem_categoria') AS categoria,
  pip.empresa,
  d.pipeline_id,
  COUNT(d.id) AS quantidade,
  COALESCE(SUM(d.valor), 0) AS valor_perdido
FROM deals d
JOIN pipelines pip ON pip.id = d.pipeline_id
WHERE d.status = 'perdido'
GROUP BY motivo, categoria, pip.empresa, d.pipeline_id
ORDER BY quantidade DESC;

-- View 6: analytics_canal_origem
CREATE OR REPLACE VIEW public.analytics_canal_origem WITH (security_invoker = true) AS
SELECT
  COALESCE(d.canal_origem, 'Não informado') AS canal,
  pip.empresa,
  d.pipeline_id,
  COUNT(d.id) AS total_deals,
  COUNT(d.id) FILTER (WHERE d.status = 'ganho') AS deals_ganhos,
  COUNT(d.id) FILTER (WHERE d.status = 'perdido') AS deals_perdidos,
  COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'ganho'), 0) AS valor_ganho,
  CASE WHEN COUNT(d.id) FILTER (WHERE d.status IN ('ganho','perdido')) > 0
    THEN ROUND(COUNT(d.id) FILTER (WHERE d.status = 'ganho')::numeric / COUNT(d.id) FILTER (WHERE d.status IN ('ganho','perdido'))::numeric * 100, 1)
    ELSE 0 END AS win_rate
FROM deals d
JOIN pipelines pip ON pip.id = d.pipeline_id
GROUP BY canal, pip.empresa, d.pipeline_id
ORDER BY total_deals DESC;
