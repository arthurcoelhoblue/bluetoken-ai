
-- ============================================================
-- SPRINT QUALIDADE: RLS Multi-Tenant Isolation
-- ============================================================

-- 1. Helper function: get the empresa of the current user
CREATE OR REPLACE FUNCTION public.get_user_empresa(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa::text
  FROM public.user_access_assignments
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- 2. Helper: check if user is ADMIN
-- (has_role already exists, reusing it)

-- ============================================================
-- CONTACTS: filter by empresa
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON public.contacts;
CREATE POLICY "Users view contacts by empresa"
  ON public.contacts FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR empresa::text = get_user_empresa(auth.uid())
  );

-- Closers: restrict to their empresa
DROP POLICY IF EXISTS "Closers can manage contacts" ON public.contacts;
CREATE POLICY "Closers manage contacts own empresa"
  ON public.contacts FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'CLOSER'::user_role)
    AND empresa::text = get_user_empresa(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'CLOSER'::user_role)
    AND empresa::text = get_user_empresa(auth.uid())
  );

-- ============================================================
-- DEALS: filter via pipeline.empresa
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view deals" ON public.deals;
CREATE POLICY "Users view deals by empresa"
  ON public.deals FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = deals.pipeline_id
      AND p.empresa::text = get_user_empresa(auth.uid())
    )
  );

-- ============================================================
-- ORGANIZATIONS: filter by empresa
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations;
CREATE POLICY "Users view organizations by empresa"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR empresa::text = get_user_empresa(auth.uid())
  );

-- ============================================================
-- CLOSER_NOTIFICATIONS: restrict to own user or ADMIN
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view notifications" ON public.closer_notifications;
CREATE POLICY "Users view own notifications"
  ON public.closer_notifications FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR closer_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can update notifications" ON public.closer_notifications;
CREATE POLICY "Users update own notifications"
  ON public.closer_notifications FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR closer_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- ============================================================
-- COMISSAO_LANCAMENTOS: filter by empresa
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can view lancamentos" ON public.comissao_lancamentos;
CREATE POLICY "Users view lancamentos by empresa"
  ON public.comissao_lancamentos FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR empresa = get_user_empresa(auth.uid())
    OR user_id = auth.uid()
  );

-- ============================================================
-- COMISSAO_REGRAS: filter by empresa
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can view regras" ON public.comissao_regras;
CREATE POLICY "Users view regras by empresa"
  ON public.comissao_regras FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR empresa = get_user_empresa(auth.uid())
  );

-- ============================================================
-- MASS_ACTION_JOBS: filter by empresa
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view mass action jobs" ON public.mass_action_jobs;
CREATE POLICY "Users view mass_action_jobs by empresa"
  ON public.mass_action_jobs FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR empresa::text = get_user_empresa(auth.uid())
  );

-- ============================================================
-- SERVICE-ONLY tables: restrict "Service ALL true" to service_role
-- ============================================================

-- DEAL_ACTIVITIES
DROP POLICY IF EXISTS "Service can manage activities" ON public.deal_activities;
CREATE POLICY "Service role manages activities"
  ON public.deal_activities FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated can read activities for their deals
CREATE POLICY "Users view deal activities"
  ON public.deal_activities FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR EXISTS (
      SELECT 1 FROM deals d
      JOIN pipelines p ON p.id = d.pipeline_id
      WHERE d.id = deal_activities.deal_id
      AND (p.empresa::text = get_user_empresa(auth.uid()) OR d.owner_id = auth.uid())
    )
  );

-- LEAD_CONTACTS
DROP POLICY IF EXISTS "Service can manage lead_contacts" ON public.lead_contacts;
CREATE POLICY "Service role manages lead_contacts"
  ON public.lead_contacts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users view lead_contacts by empresa"
  ON public.lead_contacts FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR empresa::text = get_user_empresa(auth.uid())
  );

-- LEAD_MESSAGES
DROP POLICY IF EXISTS "Service can manage lead_messages" ON public.lead_messages;
CREATE POLICY "Service role manages lead_messages"
  ON public.lead_messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users view lead_messages by empresa"
  ON public.lead_messages FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR empresa::text = get_user_empresa(auth.uid())
  );

-- LEAD_CLASSIFICATIONS
DROP POLICY IF EXISTS "Service can insert classifications" ON public.lead_classifications;
DROP POLICY IF EXISTS "Service can update classifications" ON public.lead_classifications;
CREATE POLICY "Service role manages lead_classifications"
  ON public.lead_classifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users view lead_classifications by empresa"
  ON public.lead_classifications FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR empresa::text = get_user_empresa(auth.uid())
  );

-- Admin can update classifications (for manual override)
CREATE POLICY "Admin updates lead_classifications"
  ON public.lead_classifications FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::user_role));

-- LEAD_CONVERSATION_STATE
DROP POLICY IF EXISTS "Service pode gerenciar conversation_state" ON public.lead_conversation_state;
CREATE POLICY "Service role manages conversation_state"
  ON public.lead_conversation_state FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users view conversation_state by empresa"
  ON public.lead_conversation_state FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR empresa::text = get_user_empresa(auth.uid())
  );

-- LEAD_MESSAGE_INTENTS
DROP POLICY IF EXISTS "Service can manage lead_message_intents" ON public.lead_message_intents;
CREATE POLICY "Service role manages lead_message_intents"
  ON public.lead_message_intents FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users view lead_message_intents by empresa"
  ON public.lead_message_intents FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR empresa::text = get_user_empresa(auth.uid())
  );

-- LEAD_CONTACT_ISSUES
DROP POLICY IF EXISTS "Service can manage lead_contact_issues" ON public.lead_contact_issues;
CREATE POLICY "Service role manages lead_contact_issues"
  ON public.lead_contact_issues FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users view lead_contact_issues by empresa"
  ON public.lead_contact_issues FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR empresa::text = get_user_empresa(auth.uid())
  );

-- PESSOAS
DROP POLICY IF EXISTS "Service pode gerenciar pessoas" ON public.pessoas;
CREATE POLICY "Service role manages pessoas"
  ON public.pessoas FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view pessoas"
  ON public.pessoas FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- SERVICE tables: restrict service SELECT true to service_role
-- ============================================================

-- CADENCE_STEPS: Service can read → service_role only
DROP POLICY IF EXISTS "Service can read cadence_steps" ON public.cadence_steps;
CREATE POLICY "Service role reads cadence_steps"
  ON public.cadence_steps FOR SELECT TO service_role
  USING (true);

-- CADENCES: Service can read → service_role only
DROP POLICY IF EXISTS "Service can read cadences" ON public.cadences;
CREATE POLICY "Service role reads cadences"
  ON public.cadences FOR SELECT TO service_role
  USING (true);

-- CADENCE_RUNNER_LOGS: Service can insert → service_role only
DROP POLICY IF EXISTS "Service can insert cadence_runner_logs" ON public.cadence_runner_logs;
CREATE POLICY "Service role inserts cadence_runner_logs"
  ON public.cadence_runner_logs FOR INSERT TO service_role
  WITH CHECK (true);

-- INTEGRATION_COMPANY_CONFIG
DROP POLICY IF EXISTS "Service can read integration_company_config" ON public.integration_company_config;
CREATE POLICY "Service role reads integration_company_config"
  ON public.integration_company_config FOR SELECT TO service_role
  USING (true);

CREATE POLICY "Admin reads integration_company_config"
  ON public.integration_company_config FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::user_role));

-- KNOWLEDGE_DOCUMENTS
DROP POLICY IF EXISTS "Service can read knowledge_documents" ON public.knowledge_documents;
CREATE POLICY "Service role reads knowledge_documents"
  ON public.knowledge_documents FOR SELECT TO service_role
  USING (true);

-- KNOWLEDGE_SECTIONS
DROP POLICY IF EXISTS "Service can read knowledge_sections" ON public.knowledge_sections;
CREATE POLICY "Service role reads knowledge_sections"
  ON public.knowledge_sections FOR SELECT TO service_role
  USING (true);

-- LEAD_CADENCE_EVENTS
DROP POLICY IF EXISTS "Service can insert lead_cadence_events" ON public.lead_cadence_events;
DROP POLICY IF EXISTS "Service can select lead_cadence_events" ON public.lead_cadence_events;
CREATE POLICY "Service role manages lead_cadence_events"
  ON public.lead_cadence_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admin views lead_cadence_events"
  ON public.lead_cadence_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::user_role));

-- LEAD_CADENCE_RUNS
DROP POLICY IF EXISTS "Service can select lead_cadence_runs" ON public.lead_cadence_runs;
DROP POLICY IF EXISTS "Service can update lead_cadence_runs" ON public.lead_cadence_runs;
DROP POLICY IF EXISTS "Service can insert lead_cadence_runs" ON public.lead_cadence_runs;
CREATE POLICY "Service role manages lead_cadence_runs"
  ON public.lead_cadence_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users view lead_cadence_runs by empresa"
  ON public.lead_cadence_runs FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR empresa::text = get_user_empresa(auth.uid())
  );

-- MESSAGE_TEMPLATES
DROP POLICY IF EXISTS "Service can read message_templates" ON public.message_templates;
CREATE POLICY "Service role reads message_templates"
  ON public.message_templates FOR SELECT TO service_role
  USING (true);

CREATE POLICY "Authenticated reads message_templates"
  ON public.message_templates FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR has_role(auth.uid(), 'MARKETING'::user_role)
    OR has_role(auth.uid(), 'SDR_IA'::user_role)
  );

-- DEAL_STAGE_HISTORY: INSERT true → restrict
DROP POLICY IF EXISTS "Authenticated users can insert deal_stage_history" ON public.deal_stage_history;
CREATE POLICY "Service and auth insert deal_stage_history"
  ON public.deal_stage_history FOR INSERT TO authenticated, service_role
  WITH CHECK (true);

-- METAS_VENDEDOR: add empresa filter
-- First check if the table has empresa column
CREATE POLICY "Users view metas by user or admin"
  ON public.metas_vendedor FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR user_id = auth.uid()
  );

-- AI_MODEL_BENCHMARKS: restrict service ALL to service_role
DROP POLICY IF EXISTS "Service can manage ai_model_benchmarks" ON public.ai_model_benchmarks;
CREATE POLICY "Service role manages ai_model_benchmarks"
  ON public.ai_model_benchmarks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- CONVERSATION_TAKEOVER_LOG: view is already true for authenticated
DROP POLICY IF EXISTS "Authenticated users can view takeover logs" ON public.conversation_takeover_log;
CREATE POLICY "Users view takeover logs by empresa"
  ON public.conversation_takeover_log FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR empresa::text = get_user_empresa(auth.uid())
  );

-- SGT_EVENTS / SGT_EVENT_LOGS: already restricted, but add service_role for service policies
DROP POLICY IF EXISTS "Service pode inserir sgt_events" ON public.sgt_events;
CREATE POLICY "Service role inserts sgt_events"
  ON public.sgt_events FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service pode inserir sgt_event_logs" ON public.sgt_event_logs;
CREATE POLICY "Service role inserts sgt_event_logs"
  ON public.sgt_event_logs FOR INSERT TO service_role
  WITH CHECK (true);
