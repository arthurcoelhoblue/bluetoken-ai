
-- Fix INSERT policy: admins can assign ANY active empresa, not just their own
DROP POLICY IF EXISTS "Admin insert assignments own empresa" ON public.user_access_assignments;
CREATE POLICY "Admin insert assignments"
  ON public.user_access_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'ADMIN'::user_role)
  );

-- Fix DELETE policy similarly
DROP POLICY IF EXISTS "Admin delete assignments own empresa" ON public.user_access_assignments;
CREATE POLICY "Admin delete assignments"
  ON public.user_access_assignments
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
  );

-- Fix UPDATE policy similarly
DROP POLICY IF EXISTS "Admin update assignments own empresa" ON public.user_access_assignments;
CREATE POLICY "Admin update assignments"
  ON public.user_access_assignments
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
  );
