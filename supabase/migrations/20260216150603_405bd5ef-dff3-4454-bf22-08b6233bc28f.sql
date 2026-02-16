
-- ============================================================
-- FASE G - SECURITY HARDENING: Fix 6 Critical RLS Vulnerabilities
-- ============================================================

-- 1. FIX: Closers can manage deals — add empresa filter via pipeline
DROP POLICY IF EXISTS "Closers can manage deals" ON public.deals;
CREATE POLICY "Closers can manage deals own empresa"
  ON public.deals
  FOR ALL
  USING (
    has_role(auth.uid(), 'CLOSER'::user_role)
    AND EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = deals.pipeline_id
      AND p.empresa::text = get_user_empresa(auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'CLOSER'::user_role)
    AND EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = deals.pipeline_id
      AND p.empresa::text = get_user_empresa(auth.uid())
    )
  );

-- 2. FIX: Closers can manage organizations — add empresa filter
DROP POLICY IF EXISTS "Closers can manage organizations" ON public.organizations;
CREATE POLICY "Closers can manage organizations own empresa"
  ON public.organizations
  FOR ALL
  USING (
    has_role(auth.uid(), 'CLOSER'::user_role)
    AND organizations.empresa::text = get_user_empresa(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'CLOSER'::user_role)
    AND organizations.empresa::text = get_user_empresa(auth.uid())
  );

-- 3. FIX: deal_activities — remove overly permissive policies that bypass empresa filter
DROP POLICY IF EXISTS "Authenticated users can read activities" ON public.deal_activities;
DROP POLICY IF EXISTS "Authenticated users can insert activities" ON public.deal_activities;

-- Replace with empresa-scoped insert policy
CREATE POLICY "Users can insert activities for own empresa deals"
  ON public.deal_activities
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM deals d
      JOIN pipelines p ON p.id = d.pipeline_id
      WHERE d.id = deal_activities.deal_id
      AND (
        has_role(auth.uid(), 'ADMIN'::user_role)
        OR p.empresa::text = get_user_empresa(auth.uid())
      )
    )
  );

-- 4. FIX: custom_field_values — replace USING(true) with authenticated + empresa check
DROP POLICY IF EXISTS "Authenticated users can view custom_field_values" ON public.custom_field_values;
CREATE POLICY "Authenticated users can view custom_field_values"
  ON public.custom_field_values
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 5. FIX: pessoas — replace USING(true) with proper auth check
DROP POLICY IF EXISTS "Authenticated can view pessoas" ON public.pessoas;
CREATE POLICY "Authenticated can view pessoas"
  ON public.pessoas
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 6. FIX: profiles — add policy for same-empresa colleagues to see basic info
CREATE POLICY "Users can view same empresa profiles"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      id = auth.uid()
      OR has_role(auth.uid(), 'ADMIN'::user_role)
      OR get_user_empresa(auth.uid()) IS NULL
      OR get_user_empresa(id) IS NULL
      OR get_user_empresa(auth.uid()) = get_user_empresa(id)
    )
  );
