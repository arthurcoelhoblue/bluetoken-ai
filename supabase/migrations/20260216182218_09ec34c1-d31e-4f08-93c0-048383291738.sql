
-- =====================================================
-- BLOCO 4.1 — Multi-tenancy Schema Views + RLS Hardening
-- =====================================================

-- FASE 2A: Corrigir 4 views SECURITY DEFINER → SECURITY INVOKER

CREATE OR REPLACE VIEW public.analytics_evolucao_mensal
WITH (security_invoker = true) AS
SELECT to_char(d.created_at, 'YYYY-MM'::text) AS mes,
    c.empresa::text AS empresa, d.pipeline_id,
    count(*) AS deals_criados,
    count(*) FILTER (WHERE d.status = 'GANHO'::text) AS deals_ganhos,
    count(*) FILTER (WHERE d.status = 'PERDIDO'::text) AS deals_perdidos,
    COALESCE(sum(d.valor) FILTER (WHERE d.status = 'GANHO'::text), 0::numeric) AS valor_ganho,
    COALESCE(sum(d.valor) FILTER (WHERE d.status = 'PERDIDO'::text), 0::numeric) AS valor_perdido,
    CASE WHEN count(*) FILTER (WHERE d.status = ANY (ARRAY['GANHO'::text, 'PERDIDO'::text])) > 0 THEN round(count(*) FILTER (WHERE d.status = 'GANHO'::text)::numeric / count(*) FILTER (WHERE d.status = ANY (ARRAY['GANHO'::text, 'PERDIDO'::text]))::numeric * 100::numeric, 1) ELSE 0::numeric END AS win_rate,
    CASE WHEN count(*) FILTER (WHERE d.status = 'GANHO'::text) > 0 THEN round(sum(d.valor) FILTER (WHERE d.status = 'GANHO'::text) / count(*) FILTER (WHERE d.status = 'GANHO'::text)::numeric, 0) ELSE 0::numeric END AS ticket_medio
FROM deals d JOIN contacts c ON c.id = d.contact_id
WHERE d.created_at >= (now() - '1 year'::interval)
GROUP BY (to_char(d.created_at, 'YYYY-MM'::text)), c.empresa, d.pipeline_id
ORDER BY (to_char(d.created_at, 'YYYY-MM'::text)) DESC;

CREATE OR REPLACE VIEW public.analytics_funil_visual
WITH (security_invoker = true) AS
WITH stages AS (
    SELECT ps.id AS stage_id, ps.nome AS stage_nome, ps.posicao, ps.pipeline_id,
        pi.nome AS pipeline_nome, pi.empresa::text AS empresa
    FROM pipeline_stages ps JOIN pipelines pi ON pi.id = ps.pipeline_id
), stage_deals AS (
    SELECT d.stage_id, count(*) AS deals_count, COALESCE(sum(d.valor), 0::numeric) AS deals_valor
    FROM deals d WHERE d.status = 'ABERTO'::text GROUP BY d.stage_id
)
SELECT s.pipeline_id, s.pipeline_nome, s.empresa, s.stage_id, s.stage_nome, s.posicao,
    COALESCE(sd.deals_count, 0::bigint)::integer AS deals_entrada,
    COALESCE(lead(sd.deals_count) OVER (PARTITION BY s.pipeline_id ORDER BY s.posicao), 0::bigint)::integer AS deals_saida,
    CASE WHEN COALESCE(sd.deals_count, 0::bigint) > 0 THEN round(COALESCE(lead(sd.deals_count) OVER (PARTITION BY s.pipeline_id ORDER BY s.posicao), 0::bigint)::numeric / sd.deals_count::numeric * 100::numeric, 1) ELSE 0::numeric END AS taxa_conversao,
    COALESCE(sd.deals_valor, 0::numeric) AS valor_entrada,
    COALESCE(lead(sd.deals_valor) OVER (PARTITION BY s.pipeline_id ORDER BY s.posicao), 0::numeric) AS valor_saida
FROM stages s LEFT JOIN stage_deals sd ON sd.stage_id = s.stage_id
ORDER BY s.pipeline_id, s.posicao;

CREATE OR REPLACE VIEW public.analytics_ltv_cohort
WITH (security_invoker = true) AS
SELECT to_char(d.created_at, 'YYYY-MM'::text) AS cohort_mes, c.empresa::text AS empresa,
    count(*) AS total_deals,
    count(*) FILTER (WHERE d.status = 'GANHO'::text) AS deals_ganhos,
    COALESCE(sum(d.valor) FILTER (WHERE d.status = 'GANHO'::text), 0::numeric) AS valor_total,
    CASE WHEN count(*) > 0 THEN round(COALESCE(sum(d.valor) FILTER (WHERE d.status = 'GANHO'::text), 0::numeric) / count(*)::numeric, 0) ELSE 0::numeric END AS ltv_medio,
    CASE WHEN count(*) FILTER (WHERE d.status = ANY (ARRAY['GANHO'::text, 'PERDIDO'::text])) > 0 THEN round(count(*) FILTER (WHERE d.status = 'GANHO'::text)::numeric / count(*) FILTER (WHERE d.status = ANY (ARRAY['GANHO'::text, 'PERDIDO'::text]))::numeric * 100::numeric, 1) ELSE 0::numeric END AS win_rate
FROM deals d JOIN contacts c ON c.id = d.contact_id
GROUP BY (to_char(d.created_at, 'YYYY-MM'::text)), c.empresa
ORDER BY (to_char(d.created_at, 'YYYY-MM'::text)) DESC;

CREATE OR REPLACE VIEW public.seller_leaderboard
WITH (security_invoker = true) AS
WITH pontos_mes AS (
    SELECT user_id, empresa, sum(pontos) AS pontos_mes FROM seller_points_log
    WHERE created_at >= date_trunc('month'::text, now()) GROUP BY user_id, empresa
), badges_count AS (
    SELECT user_id, empresa, count(*) AS total_badges FROM seller_badge_awards GROUP BY user_id, empresa
), streak AS (
    SELECT da.user_id, COALESCE(c.empresa::text, 'BLUE'::text) AS empresa, count(DISTINCT da.created_at::date) AS streak_dias
    FROM deal_activities da LEFT JOIN deals d ON d.id = da.deal_id LEFT JOIN contacts c ON c.id = d.contact_id
    WHERE da.created_at >= (now() - '30 days'::interval) GROUP BY da.user_id, c.empresa
)
SELECT p.id AS user_id, p.nome AS vendedor_nome, p.avatar_url AS vendedor_avatar,
    COALESCE(pm.empresa, bc.empresa, s.empresa, 'BLUE'::text) AS empresa,
    COALESCE(pm.pontos_mes, 0::bigint) AS pontos_mes,
    COALESCE(bc.total_badges, 0::bigint)::integer AS total_badges,
    COALESCE(s.streak_dias, 0::bigint)::integer AS streak_dias,
    row_number() OVER (PARTITION BY (COALESCE(pm.empresa, bc.empresa, s.empresa, 'BLUE'::text)) ORDER BY (COALESCE(pm.pontos_mes, 0::bigint)) DESC)::integer AS ranking_posicao
FROM profiles p
LEFT JOIN pontos_mes pm ON pm.user_id = p.id
LEFT JOIN badges_count bc ON bc.user_id = p.id AND bc.empresa = pm.empresa
LEFT JOIN streak s ON s.user_id = p.id AND s.empresa = COALESCE(pm.empresa, bc.empresa)
WHERE COALESCE(pm.pontos_mes, 0::bigint) > 0 OR COALESCE(bc.total_badges, 0::bigint) > 0;

-- FASE 2B: Corrigir RLS policies permissivas (role {public} → service_role)

DROP POLICY IF EXISTS "Service role full access" ON public.ai_rate_limits;
CREATE POLICY "Service role full access" ON public.ai_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications" ON public.notifications FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service can insert event logs" ON public.sgt_event_logs;
CREATE POLICY "Service can insert event logs" ON public.sgt_event_logs FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service can insert events" ON public.sgt_events;
CREATE POLICY "Service can insert events" ON public.sgt_events FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update events" ON public.sgt_events;
CREATE POLICY "Service can update events" ON public.sgt_events FOR UPDATE TO service_role USING (true);

-- FASE 2C: Policy para webhook_rate_limits (RLS enabled, no policies)
CREATE POLICY "Service role manages webhook_rate_limits" ON public.webhook_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);

-- FASE 1: Criar schemas tenant
CREATE SCHEMA IF NOT EXISTS blue;
CREATE SCHEMA IF NOT EXISTS tokeniza;
GRANT USAGE ON SCHEMA blue TO authenticated, service_role;
GRANT USAGE ON SCHEMA tokeniza TO authenticated, service_role;

-- FASE 3: Função provision_tenant_schema
CREATE OR REPLACE FUNCTION public.provision_tenant_schema(tenant_empresa TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  schema_name TEXT;
  direct_tables TEXT[] := ARRAY[
    'contacts', 'organizations', 'pipelines', 'cadences',
    'lead_contacts', 'lead_messages', 'lead_cadence_runs',
    'lead_classifications', 'lead_contact_issues', 'lead_conversation_state',
    'lead_message_intents', 'notifications', 'message_templates',
    'capture_forms', 'capture_form_submissions', 'calls',
    'comissao_lancamentos', 'comissao_regras', 'metas_vendedor',
    'cs_customers', 'cs_incidents', 'cs_playbooks', 'cs_playbook_runs',
    'cs_surveys', 'closer_notifications', 'conversation_takeover_log',
    'copilot_insights', 'copilot_messages', 'custom_field_definitions',
    'follow_up_optimal_hours', 'import_jobs', 'import_mapping',
    'integration_company_config', 'knowledge_faq',
    'mass_action_jobs', 'pipeline_auto_rules',
    'product_knowledge', 'rate_limit_log', 'revenue_forecast_log',
    'sazonalidade_indices', 'seller_badge_awards', 'seller_points_log',
    'sgt_events', 'amelia_learnings', 'analytics_events',
    'ai_usage_log', 'zadarma_config', 'zadarma_extensions',
    'user_access_assignments'
  ];
  tbl TEXT;
BEGIN
  schema_name := lower(tenant_empresa);
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated, service_role', schema_name);
  
  -- Tables with direct empresa column
  FOREACH tbl IN ARRAY direct_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'empresa')
    THEN
      EXECUTE format('CREATE OR REPLACE VIEW %I.%I WITH (security_invoker = true) AS SELECT * FROM public.%I WHERE empresa = %L', schema_name, tbl, tbl, tenant_empresa);
    END IF;
  END LOOP;
  
  -- Deals via pipeline
  EXECUTE format('CREATE OR REPLACE VIEW %I.deals WITH (security_invoker = true) AS SELECT d.* FROM public.deals d JOIN public.pipelines p ON p.id = d.pipeline_id WHERE p.empresa = %L', schema_name, tenant_empresa);
  -- Deal activities via deal->pipeline
  EXECUTE format('CREATE OR REPLACE VIEW %I.deal_activities WITH (security_invoker = true) AS SELECT da.* FROM public.deal_activities da JOIN public.deals d ON d.id = da.deal_id JOIN public.pipelines p ON p.id = d.pipeline_id WHERE p.empresa = %L', schema_name, tenant_empresa);
  -- Deal stage history
  EXECUTE format('CREATE OR REPLACE VIEW %I.deal_stage_history WITH (security_invoker = true) AS SELECT dsh.* FROM public.deal_stage_history dsh JOIN public.deals d ON d.id = dsh.deal_id JOIN public.pipelines p ON p.id = d.pipeline_id WHERE p.empresa = %L', schema_name, tenant_empresa);
  -- Deal cadence runs
  EXECUTE format('CREATE OR REPLACE VIEW %I.deal_cadence_runs WITH (security_invoker = true) AS SELECT dcr.* FROM public.deal_cadence_runs dcr JOIN public.deals d ON d.id = dcr.deal_id JOIN public.pipelines p ON p.id = d.pipeline_id WHERE p.empresa = %L', schema_name, tenant_empresa);
  -- Pipeline stages
  EXECUTE format('CREATE OR REPLACE VIEW %I.pipeline_stages WITH (security_invoker = true) AS SELECT ps.* FROM public.pipeline_stages ps JOIN public.pipelines p ON p.id = ps.pipeline_id WHERE p.empresa = %L', schema_name, tenant_empresa);
  -- Cadence steps
  EXECUTE format('CREATE OR REPLACE VIEW %I.cadence_steps WITH (security_invoker = true) AS SELECT cs.* FROM public.cadence_steps cs JOIN public.cadences c ON c.id = cs.cadence_id WHERE c.empresa = %L', schema_name, tenant_empresa);
  -- Cadence stage triggers
  EXECUTE format('CREATE OR REPLACE VIEW %I.cadence_stage_triggers WITH (security_invoker = true) AS SELECT cst.* FROM public.cadence_stage_triggers cst JOIN public.cadences c ON c.id = cst.cadence_id WHERE c.empresa = %L', schema_name, tenant_empresa);
  -- Lead cadence events
  EXECUTE format('CREATE OR REPLACE VIEW %I.lead_cadence_events WITH (security_invoker = true) AS SELECT lce.* FROM public.lead_cadence_events lce JOIN public.lead_cadence_runs lcr ON lcr.id = lce.lead_cadence_run_id WHERE lcr.empresa = %L', schema_name, tenant_empresa);
  
  EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO authenticated, service_role', schema_name);
END;
$$;

-- Provisionar tenants existentes
SELECT public.provision_tenant_schema('BLUE');
SELECT public.provision_tenant_schema('TOKENIZA');
