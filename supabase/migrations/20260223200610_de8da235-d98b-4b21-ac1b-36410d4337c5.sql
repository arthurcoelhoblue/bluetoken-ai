DROP POLICY IF EXISTS "Authenticated users can update conversation_state in own empresa" ON public.lead_conversation_state;

CREATE POLICY "Authenticated users can update conversation_state in own empresa"
ON public.lead_conversation_state
FOR UPDATE
TO authenticated
USING (
  (empresa::text = ANY (get_user_empresas(auth.uid())))
)
WITH CHECK (
  (empresa::text = ANY (get_user_empresas(auth.uid())))
);