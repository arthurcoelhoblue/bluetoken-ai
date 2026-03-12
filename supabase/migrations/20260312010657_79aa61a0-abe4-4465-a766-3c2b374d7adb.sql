
CREATE TABLE public.pipeline_saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  match_mode TEXT NOT NULL DEFAULT 'all',
  conditions JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own filters"
  ON public.pipeline_saved_filters FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
