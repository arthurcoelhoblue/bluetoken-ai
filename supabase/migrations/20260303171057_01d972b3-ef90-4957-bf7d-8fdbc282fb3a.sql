
-- Tabela de mapeamento de formulários Elementor
CREATE TABLE public.elementor_form_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id TEXT NOT NULL UNIQUE,
  empresa TEXT NOT NULL DEFAULT 'TOKENIZA',
  pipeline_id UUID REFERENCES public.pipelines(id),
  stage_id UUID REFERENCES public.pipeline_stages(id),
  field_map JSONB NOT NULL DEFAULT '{}',
  tags_auto TEXT[] NOT NULL DEFAULT '{}',
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: apenas service_role acessa (edge function)
ALTER TABLE public.elementor_form_mappings ENABLE ROW LEVEL SECURITY;

-- Policy para authenticated users poderem ler/gerenciar via UI admin
CREATE POLICY "Authenticated users can view mappings"
  ON public.elementor_form_mappings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert mappings"
  ON public.elementor_form_mappings FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update mappings"
  ON public.elementor_form_mappings FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete mappings"
  ON public.elementor_form_mappings FOR DELETE
  TO authenticated USING (true);

-- Index por form_id para lookup rápido no webhook
CREATE INDEX idx_elementor_form_mappings_form_id ON public.elementor_form_mappings(form_id);
