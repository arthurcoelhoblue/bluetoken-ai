
-- Bloco 7: Corrigir RLS de amelia_learnings para filtrar por empresa
-- Atualmente qualquer usuário autenticado pode ler/atualizar TODOS os registros

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can read learnings" ON public.amelia_learnings;
DROP POLICY IF EXISTS "Service role can insert learnings" ON public.amelia_learnings;
DROP POLICY IF EXISTS "Users can update learnings" ON public.amelia_learnings;

-- SELECT: filtrar por empresa do usuário (ou NULL = admin global)
CREATE POLICY "Users can read own empresa learnings"
ON public.amelia_learnings
FOR SELECT
TO authenticated
USING (
  empresa::text = COALESCE(public.get_user_empresa(auth.uid()), empresa::text)
);

-- INSERT: apenas service_role (edge functions)
CREATE POLICY "Service role can insert learnings"
ON public.amelia_learnings
FOR INSERT
TO service_role
WITH CHECK (true);

-- UPDATE: apenas service_role ou admin da mesma empresa
CREATE POLICY "Service role can update learnings"
ON public.amelia_learnings
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can update own empresa learnings"
ON public.amelia_learnings
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN'::public.user_role)
  AND empresa::text = COALESCE(public.get_user_empresa(auth.uid()), empresa::text)
);
