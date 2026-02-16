-- Fase 1: Fix deal_stage_history RLS — replace USING(true) with empresa filter via deals->pipelines
DROP POLICY IF EXISTS "Authenticated users can view deal_stage_history" ON public.deal_stage_history;

CREATE POLICY "Authenticated users can view deal_stage_history"
ON public.deal_stage_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE d.id = deal_stage_history.deal_id
      AND p.empresa::text = public.get_user_empresa(auth.uid())
  )
);