
-- Tabela empresas: fonte de verdade para tenants
CREATE TABLE public.empresas (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'bg-primary',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed com dados atuais
INSERT INTO public.empresas (id, label, color) VALUES
  ('BLUE', 'Blue Consult', 'bg-primary'),
  ('TOKENIZA', 'Tokeniza', 'bg-accent'),
  ('MPUPPE', 'MPuppe', 'bg-orange-500'),
  ('AXIA', 'Axia', 'bg-emerald-600');

-- RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Leitura para todos autenticados
CREATE POLICY "Authenticated users can read empresas"
  ON public.empresas FOR SELECT
  TO authenticated
  USING (true);

-- Escrita somente para ADMIN
CREATE POLICY "Admins can insert empresas"
  ON public.empresas FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can update empresas"
  ON public.empresas FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
