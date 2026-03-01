
-- Fix: Replace overly permissive policy with service-role-only policy
DROP POLICY "Service role full access on deal_creation_failures" ON public.deal_creation_failures;

-- Service role bypasses RLS by default, so we don't need an explicit policy.
-- Edge functions using createServiceClient() already bypass RLS.
-- Admins can also update resolved status
CREATE POLICY "Admins can update deal creation failures"
  ON public.deal_creation_failures
  FOR UPDATE
  USING (
    empresa IN (SELECT unnest(public.get_user_empresas(auth.uid())))
    AND public.has_role(auth.uid(), 'ADMIN')
  )
  WITH CHECK (
    empresa IN (SELECT unnest(public.get_user_empresas(auth.uid())))
    AND public.has_role(auth.uid(), 'ADMIN')
  );
