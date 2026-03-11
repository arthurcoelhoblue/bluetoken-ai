
-- Table for duplicate lead pendencies
CREATE TABLE public.duplicate_pendencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  new_contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  new_deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  existing_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  existing_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  match_type TEXT NOT NULL,
  match_details JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.duplicate_pendencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read duplicate_pendencies by empresa"
  ON public.duplicate_pendencies FOR SELECT TO authenticated
  USING (empresa IN (SELECT unnest(public.get_user_empresas(auth.uid()))));

CREATE POLICY "Authenticated users can update duplicate_pendencies by empresa"
  ON public.duplicate_pendencies FOR UPDATE TO authenticated
  USING (empresa IN (SELECT unnest(public.get_user_empresas(auth.uid()))));

CREATE POLICY "Service role can insert duplicate_pendencies"
  ON public.duplicate_pendencies FOR INSERT TO service_role
  WITH CHECK (true);

CREATE INDEX idx_duplicate_pendencies_status ON public.duplicate_pendencies (status) WHERE status = 'PENDENTE';
CREATE INDEX idx_duplicate_pendencies_empresa ON public.duplicate_pendencies (empresa);
