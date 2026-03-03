
-- Table to store SGT client sync status for renewal timing
CREATE TABLE public.sgt_client_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf TEXT,
  status_declaracao TEXT NOT NULL DEFAULT 'PENDENTE',
  data_finalizacao TIMESTAMPTZ,
  plano_atual TEXT,
  vendedor_responsavel TEXT,
  renewal_deal_created UUID REFERENCES public.deals(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sgt_client_status ENABLE ROW LEVEL SECURITY;

-- RLS: tenant isolation via user_access_assignments
CREATE POLICY "Users see sgt_client_status of their empresas"
  ON public.sgt_client_status FOR SELECT TO authenticated
  USING (empresa = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "Users can insert sgt_client_status for their empresas"
  ON public.sgt_client_status FOR INSERT TO authenticated
  WITH CHECK (empresa = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "Users can update sgt_client_status of their empresas"
  ON public.sgt_client_status FOR UPDATE TO authenticated
  USING (empresa = ANY(public.get_user_empresas(auth.uid())));

-- Service role bypass for edge functions
CREATE POLICY "Service role full access to sgt_client_status"
  ON public.sgt_client_status FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Index for common queries
CREATE INDEX idx_sgt_client_status_empresa_status ON public.sgt_client_status(empresa, status_declaracao);
CREATE INDEX idx_sgt_client_status_renewal ON public.sgt_client_status(empresa) WHERE renewal_deal_created IS NULL;
