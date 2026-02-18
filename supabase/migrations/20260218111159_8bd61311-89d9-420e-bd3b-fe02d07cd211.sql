
-- Table for tracking contracts per fiscal year
CREATE TABLE public.cs_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.cs_customers(id) ON DELETE CASCADE,
  empresa public.empresa_tipo NOT NULL,
  ano_fiscal INTEGER NOT NULL,
  plano TEXT NOT NULL DEFAULT '',
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_contratacao DATE,
  data_vencimento DATE,
  status TEXT NOT NULL DEFAULT 'ATIVO',
  renovado_em TIMESTAMPTZ,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, ano_fiscal)
);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_cs_contract_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('ATIVO', 'RENOVADO', 'CANCELADO', 'PENDENTE', 'VENCIDO') THEN
    RAISE EXCEPTION 'Invalid contract status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_cs_contract_status
  BEFORE INSERT OR UPDATE ON public.cs_contracts
  FOR EACH ROW EXECUTE FUNCTION public.validate_cs_contract_status();

-- Updated_at trigger
CREATE TRIGGER update_cs_contracts_updated_at
  BEFORE UPDATE ON public.cs_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.cs_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_contracts_select" ON public.cs_contracts
  FOR SELECT USING (empresa::text = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "cs_contracts_insert" ON public.cs_contracts
  FOR INSERT WITH CHECK (empresa::text = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "cs_contracts_update" ON public.cs_contracts
  FOR UPDATE USING (empresa::text = ANY(public.get_user_empresas(auth.uid())));

CREATE POLICY "cs_contracts_delete" ON public.cs_contracts
  FOR DELETE USING (empresa::text = ANY(public.get_user_empresas(auth.uid())));

-- Index for common queries
CREATE INDEX idx_cs_contracts_customer ON public.cs_contracts(customer_id);
CREATE INDEX idx_cs_contracts_empresa_ano ON public.cs_contracts(empresa, ano_fiscal);
CREATE INDEX idx_cs_contracts_status ON public.cs_contracts(status);
