
CREATE TABLE public.mautic_company_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  mautic_url TEXT NOT NULL DEFAULT '',
  mautic_username TEXT,
  mautic_password TEXT,
  segment_id TEXT,
  custom_fields JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_mautic_company_config_empresa ON public.mautic_company_config (empresa);
ALTER TABLE public.mautic_company_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage mautic config"
  ON public.mautic_company_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
