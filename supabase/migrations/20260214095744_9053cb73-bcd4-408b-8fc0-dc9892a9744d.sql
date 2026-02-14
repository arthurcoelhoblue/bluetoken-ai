
-- Tabela de índices de sazonalidade por empresa
CREATE TABLE public.sazonalidade_indices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL,
  mes INT NOT NULL CHECK (mes >= 1 AND mes <= 12),
  indice NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id),
  UNIQUE(empresa, mes)
);

-- Enable RLS
ALTER TABLE public.sazonalidade_indices ENABLE ROW LEVEL SECURITY;

-- Leitura para autenticados
CREATE POLICY "Authenticated users can read sazonalidade"
  ON public.sazonalidade_indices FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ADMIN pode inserir/atualizar
CREATE POLICY "Admin can insert sazonalidade"
  ON public.sazonalidade_indices FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admin can update sazonalidade"
  ON public.sazonalidade_indices FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Seed com índices default do relatório SGT para BLUE
INSERT INTO public.sazonalidade_indices (empresa, mes, indice) VALUES
  ('BLUE', 1, 0.63), ('BLUE', 2, 0.75), ('BLUE', 3, 1.22), ('BLUE', 4, 0.73),
  ('BLUE', 5, 2.28), ('BLUE', 6, 0.73), ('BLUE', 7, 0.84), ('BLUE', 8, 0.96),
  ('BLUE', 9, 0.32), ('BLUE', 10, 1.21), ('BLUE', 11, 1.07), ('BLUE', 12, 2.47);

-- Seed para TOKENIZA (índices neutros 1.0)
INSERT INTO public.sazonalidade_indices (empresa, mes, indice) VALUES
  ('TOKENIZA', 1, 1.0), ('TOKENIZA', 2, 1.0), ('TOKENIZA', 3, 1.0), ('TOKENIZA', 4, 1.0),
  ('TOKENIZA', 5, 1.0), ('TOKENIZA', 6, 1.0), ('TOKENIZA', 7, 1.0), ('TOKENIZA', 8, 1.0),
  ('TOKENIZA', 9, 1.0), ('TOKENIZA', 10, 1.0), ('TOKENIZA', 11, 1.0), ('TOKENIZA', 12, 1.0);

-- RLS para deal_loss_categories (caso não tenha)
-- Leitura para autenticados
CREATE POLICY "Authenticated users can read loss categories"
  ON public.deal_loss_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ADMIN pode CRUD
CREATE POLICY "Admin can insert loss categories"
  ON public.deal_loss_categories FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admin can update loss categories"
  ON public.deal_loss_categories FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admin can delete loss categories"
  ON public.deal_loss_categories FOR DELETE
  USING (public.has_role(auth.uid(), 'ADMIN'));
