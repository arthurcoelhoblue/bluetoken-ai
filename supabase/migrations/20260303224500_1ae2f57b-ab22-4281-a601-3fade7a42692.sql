
-- Marketing Lists feature
CREATE TABLE public.marketing_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'MANUAL',
  total_leads INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see marketing_lists of their empresas"
  ON public.marketing_lists FOR SELECT TO authenticated
  USING (empresa = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "Users can insert marketing_lists for their empresas"
  ON public.marketing_lists FOR INSERT TO authenticated
  WITH CHECK (empresa = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "Users can update marketing_lists of their empresas"
  ON public.marketing_lists FOR UPDATE TO authenticated
  USING (empresa = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "Users can delete marketing_lists of their empresas"
  ON public.marketing_lists FOR DELETE TO authenticated
  USING (empresa = ANY(public.get_user_empresas(auth.uid())));

CREATE TABLE public.marketing_list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.marketing_lists(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id),
  legacy_lead_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  notas TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  contatado_at TIMESTAMPTZ,
  UNIQUE(list_id, contact_id)
);

ALTER TABLE public.marketing_list_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see marketing_list_members via list empresa"
  ON public.marketing_list_members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.marketing_lists ml
    WHERE ml.id = marketing_list_members.list_id
    AND ml.empresa = ANY(public.get_user_empresas(auth.uid()))
  ));

CREATE POLICY "Users can insert marketing_list_members via list empresa"
  ON public.marketing_list_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.marketing_lists ml
    WHERE ml.id = marketing_list_members.list_id
    AND ml.empresa = ANY(public.get_user_empresas(auth.uid()))
  ));

CREATE POLICY "Users can update marketing_list_members via list empresa"
  ON public.marketing_list_members FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.marketing_lists ml
    WHERE ml.id = marketing_list_members.list_id
    AND ml.empresa = ANY(public.get_user_empresas(auth.uid()))
  ));

CREATE POLICY "Users can delete marketing_list_members via list empresa"
  ON public.marketing_list_members FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.marketing_lists ml
    WHERE ml.id = marketing_list_members.list_id
    AND ml.empresa = ANY(public.get_user_empresas(auth.uid()))
  ));

-- Trigger to auto-update total_leads count
CREATE OR REPLACE FUNCTION public.fn_update_marketing_list_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE marketing_lists SET total_leads = (
      SELECT COUNT(*) FROM marketing_list_members WHERE list_id = NEW.list_id AND status != 'REMOVIDO'
    ), updated_at = now() WHERE id = NEW.list_id;
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE marketing_lists SET total_leads = (
      SELECT COUNT(*) FROM marketing_list_members WHERE list_id = OLD.list_id AND status != 'REMOVIDO'
    ), updated_at = now() WHERE id = OLD.list_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_marketing_list_count
AFTER INSERT OR UPDATE OR DELETE ON public.marketing_list_members
FOR EACH ROW EXECUTE FUNCTION public.fn_update_marketing_list_count();

-- Deal notes table for call summaries and general notes
CREATE TABLE public.deal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see deal_notes via deal pipeline empresa"
  ON public.deal_notes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE d.id = deal_notes.deal_id
    AND p.empresa::text = ANY(public.get_user_empresas(auth.uid()))
  ));

CREATE POLICY "Users can insert deal_notes via deal pipeline empresa"
  ON public.deal_notes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE d.id = deal_notes.deal_id
    AND p.empresa::text = ANY(public.get_user_empresas(auth.uid()))
  ));

CREATE POLICY "Users can update deal_notes via deal pipeline empresa"
  ON public.deal_notes FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE d.id = deal_notes.deal_id
    AND p.empresa::text = ANY(public.get_user_empresas(auth.uid()))
  ));

CREATE POLICY "Users can delete deal_notes via deal pipeline empresa"
  ON public.deal_notes FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.pipelines p ON p.id = d.pipeline_id
    WHERE d.id = deal_notes.deal_id
    AND p.empresa::text = ANY(public.get_user_empresas(auth.uid()))
  ));

CREATE INDEX idx_deal_notes_deal_id ON public.deal_notes(deal_id);
CREATE INDEX idx_marketing_lists_empresa ON public.marketing_lists(empresa);
CREATE INDEX idx_marketing_list_members_list_id ON public.marketing_list_members(list_id);
