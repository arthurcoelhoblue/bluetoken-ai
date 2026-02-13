
-- Table: capture_forms
CREATE TABLE public.capture_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  descricao TEXT,
  pipeline_id UUID REFERENCES public.pipelines(id),
  stage_id UUID REFERENCES public.pipeline_stages(id),
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: capture_form_submissions
CREATE TABLE public.capture_form_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.capture_forms(id) ON DELETE CASCADE,
  empresa TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  rating_score INTEGER,
  contact_id UUID REFERENCES public.contacts(id),
  deal_id UUID REFERENCES public.deals(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_capture_forms_empresa ON public.capture_forms(empresa);
CREATE INDEX idx_capture_forms_slug ON public.capture_forms(slug);
CREATE INDEX idx_capture_form_submissions_form_id ON public.capture_form_submissions(form_id);

-- RLS: capture_forms
ALTER TABLE public.capture_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view forms from their empresa"
  ON public.capture_forms FOR SELECT
  USING (empresa = public.get_user_empresa(auth.uid()));

CREATE POLICY "Users can insert forms for their empresa"
  ON public.capture_forms FOR INSERT
  WITH CHECK (empresa = public.get_user_empresa(auth.uid()));

CREATE POLICY "Users can update forms from their empresa"
  ON public.capture_forms FOR UPDATE
  USING (empresa = public.get_user_empresa(auth.uid()));

CREATE POLICY "Users can delete forms from their empresa"
  ON public.capture_forms FOR DELETE
  USING (empresa = public.get_user_empresa(auth.uid()));

-- Public read for published forms (used by public form page)
CREATE POLICY "Anyone can read published forms by slug"
  ON public.capture_forms FOR SELECT
  USING (status = 'PUBLISHED');

-- Service role bypass for edge function
CREATE POLICY "Service can manage all forms"
  ON public.capture_forms FOR ALL
  USING (auth.role() = 'service_role');

-- RLS: capture_form_submissions
ALTER TABLE public.capture_form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view submissions from their empresa"
  ON public.capture_form_submissions FOR SELECT
  USING (empresa = public.get_user_empresa(auth.uid()));

CREATE POLICY "Service can manage all submissions"
  ON public.capture_form_submissions FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger for updated_at on capture_forms
CREATE TRIGGER update_capture_forms_updated_at
  BEFORE UPDATE ON public.capture_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
