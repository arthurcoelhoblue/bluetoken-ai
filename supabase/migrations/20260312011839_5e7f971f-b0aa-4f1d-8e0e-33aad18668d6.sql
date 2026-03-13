
CREATE TABLE public.webhook_tag_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT NOT NULL,
  empresa TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (webhook_id, empresa)
);

ALTER TABLE public.webhook_tag_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage webhook tags"
  ON public.webhook_tag_configs FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
