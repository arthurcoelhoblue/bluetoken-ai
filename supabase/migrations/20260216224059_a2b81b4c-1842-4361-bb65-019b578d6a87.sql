
-- =============================================
-- ETAPA 1B: RLS Hardening Batch 2 — Tabelas de suporte + CS
-- =============================================

-- ========== BLOCO 1: Tabelas com coluna empresa direta ==========

-- cadences
DROP POLICY IF EXISTS "Admins can manage cadences" ON public.cadences;
CREATE POLICY "Admins manage cadences own empresa" ON public.cadences
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- message_templates
DROP POLICY IF EXISTS "Admins can manage message_templates" ON public.message_templates;
CREATE POLICY "Admins manage message_templates own empresa" ON public.message_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- custom_field_definitions
DROP POLICY IF EXISTS "Admins can manage custom_field_definitions" ON public.custom_field_definitions;
CREATE POLICY "Admins manage custom_field_definitions own empresa" ON public.custom_field_definitions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- product_knowledge
DROP POLICY IF EXISTS "Admins can manage product_knowledge" ON public.product_knowledge;
CREATE POLICY "Admins manage product_knowledge own empresa" ON public.product_knowledge
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- metas_vendedor
DROP POLICY IF EXISTS "Admin can manage metas" ON public.metas_vendedor;
CREATE POLICY "Admin manage metas own empresa" ON public.metas_vendedor
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- comissao_lancamentos
DROP POLICY IF EXISTS "Admin can manage lancamentos" ON public.comissao_lancamentos;
CREATE POLICY "Admin manage lancamentos own empresa" ON public.comissao_lancamentos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- comissao_regras
DROP POLICY IF EXISTS "Admin can manage regras" ON public.comissao_regras;
CREATE POLICY "Admin manage regras own empresa" ON public.comissao_regras
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- follow_up_optimal_hours
DROP POLICY IF EXISTS "Admins can manage optimal hours" ON public.follow_up_optimal_hours;
CREATE POLICY "Admins manage optimal hours own empresa" ON public.follow_up_optimal_hours
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- integration_company_config
DROP POLICY IF EXISTS "Admins can manage integration_company_config" ON public.integration_company_config;
CREATE POLICY "Admins manage integration_company_config own empresa" ON public.integration_company_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- mass_action_jobs
DROP POLICY IF EXISTS "Admin and Closer can create mass action jobs" ON public.mass_action_jobs;
DROP POLICY IF EXISTS "Admin and Closer can update mass action jobs" ON public.mass_action_jobs;
DROP POLICY IF EXISTS "Admin can delete mass action jobs" ON public.mass_action_jobs;
CREATE POLICY "Create mass action jobs own empresa" ON public.mass_action_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'ADMIN') OR has_role(auth.uid(), 'CLOSER'))
    AND (empresa)::text = get_user_empresa(auth.uid())
  );
CREATE POLICY "Update mass action jobs own empresa" ON public.mass_action_jobs
  FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'ADMIN') OR has_role(auth.uid(), 'CLOSER'))
    AND (empresa)::text = get_user_empresa(auth.uid())
  );
CREATE POLICY "Delete mass action jobs own empresa" ON public.mass_action_jobs
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- sgt_events
DROP POLICY IF EXISTS "Admins can view all events" ON public.sgt_events;
CREATE POLICY "Admins view events own empresa" ON public.sgt_events
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- sazonalidade_indices
DROP POLICY IF EXISTS "Admin can insert sazonalidade" ON public.sazonalidade_indices;
DROP POLICY IF EXISTS "Admin can update sazonalidade" ON public.sazonalidade_indices;
CREATE POLICY "Admin insert sazonalidade own empresa" ON public.sazonalidade_indices
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "Admin update sazonalidade own empresa" ON public.sazonalidade_indices
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- import_jobs
DROP POLICY IF EXISTS "Admin full access on import_jobs" ON public.import_jobs;
CREATE POLICY "Admin manage import_jobs own empresa" ON public.import_jobs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- import_mapping
DROP POLICY IF EXISTS "Admin full access on import_mapping" ON public.import_mapping;
CREATE POLICY "Admin manage import_mapping own empresa" ON public.import_mapping
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- zadarma_config
DROP POLICY IF EXISTS "Admin SELECT zadarma_config" ON public.zadarma_config;
DROP POLICY IF EXISTS "Admin INSERT zadarma_config" ON public.zadarma_config;
DROP POLICY IF EXISTS "Admin UPDATE zadarma_config" ON public.zadarma_config;
DROP POLICY IF EXISTS "Admin DELETE zadarma_config" ON public.zadarma_config;
CREATE POLICY "Admin SELECT zadarma_config own empresa" ON public.zadarma_config
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "Admin INSERT zadarma_config own empresa" ON public.zadarma_config
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "Admin UPDATE zadarma_config own empresa" ON public.zadarma_config
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "Admin DELETE zadarma_config own empresa" ON public.zadarma_config
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- zadarma_extensions (INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "Admin INSERT zadarma_extensions" ON public.zadarma_extensions;
DROP POLICY IF EXISTS "Admin UPDATE zadarma_extensions" ON public.zadarma_extensions;
DROP POLICY IF EXISTS "Admin DELETE zadarma_extensions" ON public.zadarma_extensions;
CREATE POLICY "Admin INSERT zadarma_extensions own empresa" ON public.zadarma_extensions
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "Admin UPDATE zadarma_extensions own empresa" ON public.zadarma_extensions
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "Admin DELETE zadarma_extensions own empresa" ON public.zadarma_extensions
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- user_access_assignments (has empresa column directly)
DROP POLICY IF EXISTS "Authenticated users can view assignments" ON public.user_access_assignments;
DROP POLICY IF EXISTS "Admins can insert assignments" ON public.user_access_assignments;
DROP POLICY IF EXISTS "Admins can update assignments" ON public.user_access_assignments;
DROP POLICY IF EXISTS "Admins can delete assignments" ON public.user_access_assignments;
CREATE POLICY "View assignments own empresa" ON public.user_access_assignments
  FOR SELECT TO authenticated
  USING ((empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "Admin insert assignments own empresa" ON public.user_access_assignments
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "Admin update assignments own empresa" ON public.user_access_assignments
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "Admin delete assignments own empresa" ON public.user_access_assignments
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- knowledge_faq
DROP POLICY IF EXISTS "Authenticated users can create FAQ items" ON public.knowledge_faq;
DROP POLICY IF EXISTS "Authors and admins can delete FAQ items" ON public.knowledge_faq;
DROP POLICY IF EXISTS "Authors and moderators can update FAQ items" ON public.knowledge_faq;
CREATE POLICY "Create FAQ items own empresa" ON public.knowledge_faq
  FOR INSERT TO authenticated
  WITH CHECK (
    criado_por = auth.uid()
    AND (empresa)::text = get_user_empresa(auth.uid())
  );
CREATE POLICY "Delete FAQ items own empresa" ON public.knowledge_faq
  FOR DELETE TO authenticated
  USING (
    (empresa)::text = get_user_empresa(auth.uid())
    AND (
      (criado_por = auth.uid() AND status = 'RASCUNHO')
      OR has_role(auth.uid(), 'ADMIN')
    )
  );
CREATE POLICY "Update FAQ items own empresa" ON public.knowledge_faq
  FOR UPDATE TO authenticated
  USING (
    (empresa)::text = get_user_empresa(auth.uid())
    AND (
      (criado_por = auth.uid() AND status = 'RASCUNHO')
      OR has_role(auth.uid(), 'ADMIN')
    )
  );

-- pipeline_auto_rules
DROP POLICY IF EXISTS "Admins can manage auto rules" ON public.pipeline_auto_rules;
CREATE POLICY "Admins manage auto rules own empresa" ON public.pipeline_auto_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- ========== BLOCO 2: Tabelas CS — remover brecha OR IS NULL + corrigir DELETE ==========

-- cs_customers
DROP POLICY IF EXISTS "cs_customers_select" ON public.cs_customers;
DROP POLICY IF EXISTS "cs_customers_insert" ON public.cs_customers;
DROP POLICY IF EXISTS "cs_customers_update" ON public.cs_customers;
DROP POLICY IF EXISTS "cs_customers_delete" ON public.cs_customers;
CREATE POLICY "cs_customers_select" ON public.cs_customers
  FOR SELECT TO authenticated
  USING ((empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "cs_customers_insert" ON public.cs_customers
  FOR INSERT TO authenticated
  WITH CHECK ((empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "cs_customers_update" ON public.cs_customers
  FOR UPDATE TO authenticated
  USING ((empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "cs_customers_delete" ON public.cs_customers
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- cs_incidents
DROP POLICY IF EXISTS "cs_incidents_select" ON public.cs_incidents;
DROP POLICY IF EXISTS "cs_incidents_insert" ON public.cs_incidents;
DROP POLICY IF EXISTS "cs_incidents_update" ON public.cs_incidents;
DROP POLICY IF EXISTS "cs_incidents_delete" ON public.cs_incidents;
CREATE POLICY "cs_incidents_select" ON public.cs_incidents
  FOR SELECT TO authenticated
  USING ((empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "cs_incidents_insert" ON public.cs_incidents
  FOR INSERT TO authenticated
  WITH CHECK ((empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "cs_incidents_update" ON public.cs_incidents
  FOR UPDATE TO authenticated
  USING ((empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "cs_incidents_delete" ON public.cs_incidents
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- cs_surveys
DROP POLICY IF EXISTS "cs_surveys_select" ON public.cs_surveys;
DROP POLICY IF EXISTS "cs_surveys_insert" ON public.cs_surveys;
DROP POLICY IF EXISTS "cs_surveys_update" ON public.cs_surveys;
DROP POLICY IF EXISTS "cs_surveys_delete" ON public.cs_surveys;
CREATE POLICY "cs_surveys_select" ON public.cs_surveys
  FOR SELECT TO authenticated
  USING ((empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "cs_surveys_insert" ON public.cs_surveys
  FOR INSERT TO authenticated
  WITH CHECK ((empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "cs_surveys_update" ON public.cs_surveys
  FOR UPDATE TO authenticated
  USING ((empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "cs_surveys_delete" ON public.cs_surveys
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- cs_playbooks
DROP POLICY IF EXISTS "cs_playbooks_select" ON public.cs_playbooks;
DROP POLICY IF EXISTS "cs_playbooks_insert" ON public.cs_playbooks;
DROP POLICY IF EXISTS "cs_playbooks_update" ON public.cs_playbooks;
DROP POLICY IF EXISTS "cs_playbooks_delete" ON public.cs_playbooks;
CREATE POLICY "cs_playbooks_select" ON public.cs_playbooks
  FOR SELECT TO authenticated
  USING ((empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "cs_playbooks_insert" ON public.cs_playbooks
  FOR INSERT TO authenticated
  WITH CHECK ((empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "cs_playbooks_update" ON public.cs_playbooks
  FOR UPDATE TO authenticated
  USING ((empresa)::text = get_user_empresa(auth.uid()));
CREATE POLICY "cs_playbooks_delete" ON public.cs_playbooks
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'ADMIN') AND (empresa)::text = get_user_empresa(auth.uid()));

-- cs_health_log
DROP POLICY IF EXISTS "cs_health_log_insert" ON public.cs_health_log;
DROP POLICY IF EXISTS "cs_health_log_select" ON public.cs_health_log;
CREATE POLICY "cs_health_log_insert" ON public.cs_health_log
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cs_customers c
      WHERE c.id = cs_health_log.customer_id
      AND (c.empresa)::text = get_user_empresa(auth.uid())
    )
  );
CREATE POLICY "cs_health_log_select" ON public.cs_health_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cs_customers c
      WHERE c.id = cs_health_log.customer_id
      AND (c.empresa)::text = get_user_empresa(auth.uid())
    )
  );

-- ========== BLOCO 3: Tabelas sem coluna empresa (via JOIN) ==========

-- cadence_steps
DROP POLICY IF EXISTS "Admins can manage cadence_steps" ON public.cadence_steps;
CREATE POLICY "Admins manage cadence_steps own empresa" ON public.cadence_steps
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN')
    AND EXISTS (
      SELECT 1 FROM public.cadences c
      WHERE c.id = cadence_steps.cadence_id
      AND (c.empresa)::text = get_user_empresa(auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'ADMIN')
    AND EXISTS (
      SELECT 1 FROM public.cadences c
      WHERE c.id = cadence_steps.cadence_id
      AND (c.empresa)::text = get_user_empresa(auth.uid())
    )
  );

-- custom_field_values (ADMIN + CLOSER via custom_field_definitions.empresa)
DROP POLICY IF EXISTS "Admins can manage custom_field_values" ON public.custom_field_values;
DROP POLICY IF EXISTS "Closers can manage custom_field_values" ON public.custom_field_values;
CREATE POLICY "Admins manage custom_field_values own empresa" ON public.custom_field_values
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN')
    AND EXISTS (
      SELECT 1 FROM public.custom_field_definitions d
      WHERE d.id = custom_field_values.field_id
      AND (d.empresa)::text = get_user_empresa(auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'ADMIN')
    AND EXISTS (
      SELECT 1 FROM public.custom_field_definitions d
      WHERE d.id = custom_field_values.field_id
      AND (d.empresa)::text = get_user_empresa(auth.uid())
    )
  );
CREATE POLICY "Closers manage custom_field_values own empresa" ON public.custom_field_values
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'CLOSER')
    AND EXISTS (
      SELECT 1 FROM public.custom_field_definitions d
      WHERE d.id = custom_field_values.field_id
      AND (d.empresa)::text = get_user_empresa(auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'CLOSER')
    AND EXISTS (
      SELECT 1 FROM public.custom_field_definitions d
      WHERE d.id = custom_field_values.field_id
      AND (d.empresa)::text = get_user_empresa(auth.uid())
    )
  );
