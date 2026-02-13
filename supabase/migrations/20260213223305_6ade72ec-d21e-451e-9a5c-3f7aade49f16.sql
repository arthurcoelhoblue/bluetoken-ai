
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view forms from their empresa" ON public.capture_forms;
DROP POLICY IF EXISTS "Users can insert forms for their empresa" ON public.capture_forms;
DROP POLICY IF EXISTS "Users can update forms from their empresa" ON public.capture_forms;
DROP POLICY IF EXISTS "Users can delete forms from their empresa" ON public.capture_forms;
DROP POLICY IF EXISTS "Anyone can read published forms by slug" ON public.capture_forms;
DROP POLICY IF EXISTS "Service can manage all forms" ON public.capture_forms;

-- New policies with NULL empresa fallback
CREATE POLICY "Users can view forms"
  ON public.capture_forms FOR SELECT
  USING (
    status = 'PUBLISHED'
    OR auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND (
        public.get_user_empresa(auth.uid()) IS NULL
        OR empresa = public.get_user_empresa(auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert forms"
  ON public.capture_forms FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND (
        public.get_user_empresa(auth.uid()) IS NULL
        OR empresa = public.get_user_empresa(auth.uid())
      )
    )
  );

CREATE POLICY "Users can update forms"
  ON public.capture_forms FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND (
        public.get_user_empresa(auth.uid()) IS NULL
        OR empresa = public.get_user_empresa(auth.uid())
      )
    )
  );

CREATE POLICY "Users can delete forms"
  ON public.capture_forms FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND (
        public.get_user_empresa(auth.uid()) IS NULL
        OR empresa = public.get_user_empresa(auth.uid())
      )
    )
  );
