-- Add RLS policy for deals: users with access profiles can manage deals in their empresas
-- This replaces the dependency on legacy roles (ADMIN/CLOSER) with the new access_profiles system.
CREATE POLICY "Access profile users can manage deals in own empresa"
ON public.deals
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM user_access_assignments uaa
    WHERE uaa.user_id = auth.uid()
      AND uaa.empresa::text = ANY (
        SELECT p.empresa::text FROM pipelines p WHERE p.id = deals.pipeline_id
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_access_assignments uaa
    WHERE uaa.user_id = auth.uid()
      AND uaa.empresa::text = ANY (
        SELECT p.empresa::text FROM pipelines p WHERE p.id = deals.pipeline_id
      )
  )
);