
-- =============================================
-- Patch 6: Workbench Views (Meu Dia)
-- =============================================

-- 1. workbench_tarefas: pending tasks from deal_activities
CREATE OR REPLACE VIEW public.workbench_tarefas
WITH (security_invoker = true)
AS
SELECT
  da.id,
  da.deal_id,
  da.descricao,
  da.tarefa_prazo,
  da.tarefa_concluida,
  da.created_at,
  d.titulo AS deal_titulo,
  d.valor AS deal_valor,
  d.status AS deal_status,
  d.owner_id,
  ps.nome AS stage_nome,
  ps.cor AS stage_cor,
  c.nome AS contact_nome,
  p.nome AS pipeline_nome,
  p.empresa AS pipeline_empresa
FROM deal_activities da
JOIN deals d ON d.id = da.deal_id
JOIN pipeline_stages ps ON ps.id = d.stage_id
JOIN contacts c ON c.id = d.contact_id
JOIN pipelines p ON p.id = d.pipeline_id
WHERE da.tipo = 'TAREFA'
  AND (da.tarefa_concluida = false OR da.tarefa_concluida IS NULL)
  AND d.status = 'ABERTO';

-- 2. workbench_sla_alerts: deals with SLA defined, calculate time in stage
CREATE OR REPLACE VIEW public.workbench_sla_alerts
WITH (security_invoker = true)
AS
SELECT
  d.id AS deal_id,
  d.titulo AS deal_titulo,
  d.valor AS deal_valor,
  d.owner_id,
  d.stage_id,
  ps.nome AS stage_nome,
  ps.cor AS stage_cor,
  ps.sla_minutos,
  c.nome AS contact_nome,
  p.nome AS pipeline_nome,
  p.empresa AS pipeline_empresa,
  COALESCE(
    EXTRACT(EPOCH FROM (now() - dsh.last_move)) / 60,
    EXTRACT(EPOCH FROM (now() - d.updated_at)) / 60
  )::int AS minutos_no_stage,
  CASE
    WHEN ps.sla_minutos IS NOT NULL AND ps.sla_minutos > 0 THEN
      COALESCE(
        EXTRACT(EPOCH FROM (now() - dsh.last_move)) / 60,
        EXTRACT(EPOCH FROM (now() - d.updated_at)) / 60
      )::int > ps.sla_minutos
    ELSE false
  END AS sla_estourado,
  CASE
    WHEN ps.sla_minutos IS NOT NULL AND ps.sla_minutos > 0 THEN
      LEAST(
        (COALESCE(
          EXTRACT(EPOCH FROM (now() - dsh.last_move)) / 60,
          EXTRACT(EPOCH FROM (now() - d.updated_at)) / 60
        ) / ps.sla_minutos * 100)::int,
        200
      )
    ELSE 0
  END AS sla_percentual
FROM deals d
JOIN pipeline_stages ps ON ps.id = d.stage_id
JOIN contacts c ON c.id = d.contact_id
JOIN pipelines p ON p.id = d.pipeline_id
LEFT JOIN LATERAL (
  SELECT MAX(created_at) AS last_move
  FROM deal_stage_history
  WHERE deal_id = d.id
) dsh ON true
WHERE d.fechado_em IS NULL
  AND d.status = 'ABERTO'
  AND ps.sla_minutos IS NOT NULL
  AND ps.sla_minutos > 0;

-- 3. workbench_pipeline_summary: aggregated pipeline stats per owner
CREATE OR REPLACE VIEW public.workbench_pipeline_summary
WITH (security_invoker = true)
AS
SELECT
  p.id AS pipeline_id,
  p.nome AS pipeline_nome,
  p.empresa AS pipeline_empresa,
  d.owner_id,
  COUNT(*) FILTER (WHERE d.status = 'ABERTO') AS deals_abertos,
  COUNT(*) FILTER (WHERE d.status = 'GANHO') AS deals_ganhos,
  COUNT(*) FILTER (WHERE d.status = 'PERDIDO') AS deals_perdidos,
  COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'ABERTO'), 0) AS valor_aberto,
  COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'GANHO'), 0) AS valor_ganho,
  COALESCE(SUM(d.valor) FILTER (WHERE d.status = 'PERDIDO'), 0) AS valor_perdido
FROM deals d
JOIN pipelines p ON p.id = d.pipeline_id
GROUP BY p.id, p.nome, p.empresa, d.owner_id;
