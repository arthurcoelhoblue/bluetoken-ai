
-- Fix zadarma_extensions SELECT policy: change from public to authenticated
DROP POLICY IF EXISTS "Authenticated SELECT zadarma_extensions" ON zadarma_extensions;
CREATE POLICY "Authenticated SELECT zadarma_extensions" 
  ON zadarma_extensions FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role) 
    OR (empresa::text = ANY(get_user_empresas(auth.uid())))
  );

-- Also fix zadarma_config SELECT policy if it has the same bug
DROP POLICY IF EXISTS "Authenticated SELECT zadarma_config" ON zadarma_config;
CREATE POLICY "Authenticated SELECT zadarma_config" 
  ON zadarma_config FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role)
  );
