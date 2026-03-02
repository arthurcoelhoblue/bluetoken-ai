
-- INSERT policy
CREATE POLICY "Admins can insert whatsapp_connections"
ON public.whatsapp_connections FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_access_assignments WHERE user_id = auth.uid())
);

-- UPDATE policy  
CREATE POLICY "Admins can update whatsapp_connections"
ON public.whatsapp_connections FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_access_assignments WHERE user_id = auth.uid())
);

-- DELETE policy
CREATE POLICY "Admins can delete whatsapp_connections"
ON public.whatsapp_connections FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_access_assignments WHERE user_id = auth.uid())
);
