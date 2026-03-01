
-- Tabela para rastrear falhas na criação automática de deals
CREATE TABLE public.deal_creation_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  empresa TEXT NOT NULL,
  phone_e164 TEXT,
  motivo TEXT NOT NULL,
  tentativas INT NOT NULL DEFAULT 1,
  resolvido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Índice para reconciliação eficiente
CREATE INDEX idx_deal_creation_failures_pending 
  ON public.deal_creation_failures (resolvido, tentativas) 
  WHERE resolvido = false;

-- Enable RLS
ALTER TABLE public.deal_creation_failures ENABLE ROW LEVEL SECURITY;

-- Admins podem ver falhas da sua empresa
CREATE POLICY "Admins can view deal creation failures"
  ON public.deal_creation_failures
  FOR SELECT
  USING (
    empresa IN (SELECT unnest(public.get_user_empresas(auth.uid())))
    AND public.has_role(auth.uid(), 'ADMIN')
  );

-- Service role pode inserir/atualizar (edge functions)
CREATE POLICY "Service role full access on deal_creation_failures"
  ON public.deal_creation_failures
  FOR ALL
  USING (true)
  WITH CHECK (true);
