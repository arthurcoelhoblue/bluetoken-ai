
-- =====================================================
-- BATCH 1: Hardening RLS — Tabelas críticas de dados
-- Adiciona filtro de empresa a todas as policies ADMIN
-- =====================================================

-- 1. CONTACTS — Admin ALL policy
DROP POLICY IF EXISTS "Admins can manage contacts" ON public.contacts;
CREATE POLICY "Admins can manage contacts in own empresa" ON public.contacts
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  );

-- Fix SELECT policy for contacts (was bypassing empresa for ADMIN)
DROP POLICY IF EXISTS "Users view contacts by empresa" ON public.contacts;
CREATE POLICY "Users view contacts by empresa" ON public.contacts
  FOR SELECT TO authenticated
  USING (
    (empresa)::text = get_user_empresa(auth.uid())
  );

-- 2. ORGANIZATIONS — Admin ALL policy
DROP POLICY IF EXISTS "Admins can manage organizations" ON public.organizations;
CREATE POLICY "Admins can manage organizations in own empresa" ON public.organizations
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  );

-- Fix SELECT policy for organizations
DROP POLICY IF EXISTS "Users view organizations by empresa" ON public.organizations;
CREATE POLICY "Users view organizations by empresa" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    (empresa)::text = get_user_empresa(auth.uid())
  );

-- 3. PIPELINES — Admin ALL policy
DROP POLICY IF EXISTS "Admins can manage pipelines" ON public.pipelines;
CREATE POLICY "Admins can manage pipelines in own empresa" ON public.pipelines
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  );

-- Fix SELECT policy for pipelines (was open to any authenticated)
DROP POLICY IF EXISTS "Authenticated users can view pipelines" ON public.pipelines;
CREATE POLICY "Users view pipelines by empresa" ON public.pipelines
  FOR SELECT TO authenticated
  USING (
    (empresa)::text = get_user_empresa(auth.uid())
  );

-- 4. PIPELINE_STAGES — Admin ALL policy (no empresa column, join via pipeline)
DROP POLICY IF EXISTS "Admins can manage pipeline_stages" ON public.pipeline_stages;
CREATE POLICY "Admins can manage pipeline_stages in own empresa" ON public.pipeline_stages
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND EXISTS (
      SELECT 1 FROM public.pipelines p 
      WHERE p.id = pipeline_stages.pipeline_id 
      AND (p.empresa)::text = get_user_empresa(auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND EXISTS (
      SELECT 1 FROM public.pipelines p 
      WHERE p.id = pipeline_stages.pipeline_id 
      AND (p.empresa)::text = get_user_empresa(auth.uid())
    )
  );

-- Fix SELECT policy for pipeline_stages (was open to any authenticated)
DROP POLICY IF EXISTS "Authenticated users can view pipeline_stages" ON public.pipeline_stages;
CREATE POLICY "Users view pipeline_stages by empresa" ON public.pipeline_stages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines p 
      WHERE p.id = pipeline_stages.pipeline_id 
      AND (p.empresa)::text = get_user_empresa(auth.uid())
    )
  );

-- 5. DEALS — Admin ALL policy (no empresa column, join via pipeline)
DROP POLICY IF EXISTS "Admins can manage deals" ON public.deals;
CREATE POLICY "Admins can manage deals in own empresa" ON public.deals
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND EXISTS (
      SELECT 1 FROM public.pipelines p 
      WHERE p.id = deals.pipeline_id 
      AND (p.empresa)::text = get_user_empresa(auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND EXISTS (
      SELECT 1 FROM public.pipelines p 
      WHERE p.id = deals.pipeline_id 
      AND (p.empresa)::text = get_user_empresa(auth.uid())
    )
  );

-- Fix SELECT policy for deals (was bypassing empresa for ADMIN)
DROP POLICY IF EXISTS "Users view deals by empresa and owner" ON public.deals;
CREATE POLICY "Users view deals by empresa" ON public.deals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines p 
      WHERE p.id = deals.pipeline_id 
      AND (p.empresa)::text = get_user_empresa(auth.uid())
    )
  );

-- 6. LEAD_CONTACTS — Admin SELECT policy without empresa
DROP POLICY IF EXISTS "Admins can view lead_contacts" ON public.lead_contacts;
CREATE POLICY "Admins view lead_contacts in own empresa" ON public.lead_contacts
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  );

-- Fix generic SELECT policy
DROP POLICY IF EXISTS "Users view lead_contacts by empresa" ON public.lead_contacts;
CREATE POLICY "Users view lead_contacts by empresa" ON public.lead_contacts
  FOR SELECT TO authenticated
  USING (
    (empresa)::text = get_user_empresa(auth.uid())
  );

-- 7. LEAD_MESSAGES — Admin ALL policy
DROP POLICY IF EXISTS "Admins can manage lead_messages" ON public.lead_messages;
CREATE POLICY "Admins can manage lead_messages in own empresa" ON public.lead_messages
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  );

-- Fix SELECT policy
DROP POLICY IF EXISTS "Users view lead_messages by empresa" ON public.lead_messages;
CREATE POLICY "Users view lead_messages by empresa" ON public.lead_messages
  FOR SELECT TO authenticated
  USING (
    (empresa)::text = get_user_empresa(auth.uid())
  );

-- 8. LEAD_MESSAGE_INTENTS — Admin ALL policy
DROP POLICY IF EXISTS "Admins can manage lead_message_intents" ON public.lead_message_intents;
CREATE POLICY "Admins can manage lead_message_intents in own empresa" ON public.lead_message_intents
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  );

-- Fix SELECT policy
DROP POLICY IF EXISTS "Users view lead_message_intents by empresa" ON public.lead_message_intents;
CREATE POLICY "Users view lead_message_intents by empresa" ON public.lead_message_intents
  FOR SELECT TO authenticated
  USING (
    (empresa)::text = get_user_empresa(auth.uid())
  );

-- 9. LEAD_CLASSIFICATIONS — Admin policies
DROP POLICY IF EXISTS "Admins can view all classifications" ON public.lead_classifications;
DROP POLICY IF EXISTS "Admin updates lead_classifications" ON public.lead_classifications;
CREATE POLICY "Admins can manage lead_classifications in own empresa" ON public.lead_classifications
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  );

-- Fix SELECT policy
DROP POLICY IF EXISTS "Users view lead_classifications by empresa" ON public.lead_classifications;
CREATE POLICY "Users view lead_classifications by empresa" ON public.lead_classifications
  FOR SELECT TO authenticated
  USING (
    (empresa)::text = get_user_empresa(auth.uid())
  );

-- 10. LEAD_CONVERSATION_STATE — Admin policy
DROP POLICY IF EXISTS "Admins podem ver conversation_state" ON public.lead_conversation_state;
CREATE POLICY "Admins view conversation_state in own empresa" ON public.lead_conversation_state
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  );

-- Fix SELECT policy
DROP POLICY IF EXISTS "Users view conversation_state by empresa" ON public.lead_conversation_state;
CREATE POLICY "Users view conversation_state by empresa" ON public.lead_conversation_state
  FOR SELECT TO authenticated
  USING (
    (empresa)::text = get_user_empresa(auth.uid())
  );

-- 11. LEAD_CADENCE_RUNS — Admin ALL policy
DROP POLICY IF EXISTS "Admins can manage lead_cadence_runs" ON public.lead_cadence_runs;
CREATE POLICY "Admins can manage lead_cadence_runs in own empresa" ON public.lead_cadence_runs
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  );

-- Fix SELECT policy
DROP POLICY IF EXISTS "Users view lead_cadence_runs by empresa" ON public.lead_cadence_runs;
CREATE POLICY "Users view lead_cadence_runs by empresa" ON public.lead_cadence_runs
  FOR SELECT TO authenticated
  USING (
    (empresa)::text = get_user_empresa(auth.uid())
  );

-- 12. LEAD_CONTACT_ISSUES — Admin ALL policy
DROP POLICY IF EXISTS "Admins can manage lead_contact_issues" ON public.lead_contact_issues;
CREATE POLICY "Admins can manage lead_contact_issues in own empresa" ON public.lead_contact_issues
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'ADMIN'::user_role)
    AND (empresa)::text = get_user_empresa(auth.uid())
  );

-- Fix SELECT policy
DROP POLICY IF EXISTS "Users view lead_contact_issues by empresa" ON public.lead_contact_issues;
CREATE POLICY "Users view lead_contact_issues by empresa" ON public.lead_contact_issues
  FOR SELECT TO authenticated
  USING (
    (empresa)::text = get_user_empresa(auth.uid())
  );
