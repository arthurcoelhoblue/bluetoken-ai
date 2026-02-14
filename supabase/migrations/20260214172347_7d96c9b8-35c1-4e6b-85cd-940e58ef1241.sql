
-- ============================================
-- AMELIA LEARNING SYSTEM: Tabela de aprendizados
-- ============================================

CREATE TABLE public.amelia_learnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL,
  tipo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  dados JSONB DEFAULT '{}'::jsonb,
  confianca NUMERIC(3,2) DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  validado_por UUID REFERENCES public.profiles(id),
  validado_em TIMESTAMPTZ,
  aplicado BOOLEAN DEFAULT false,
  -- Sequence detection columns
  sequencia_eventos JSONB,
  sequencia_match_pct NUMERIC(5,2),
  sequencia_janela_dias INT,
  -- Dedup
  hash_titulo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_amelia_learnings_empresa ON public.amelia_learnings(empresa);
CREATE INDEX idx_amelia_learnings_tipo ON public.amelia_learnings(tipo);
CREATE INDEX idx_amelia_learnings_status ON public.amelia_learnings(status);
CREATE INDEX idx_amelia_learnings_hash ON public.amelia_learnings(hash_titulo);
CREATE INDEX idx_amelia_learnings_created ON public.amelia_learnings(created_at DESC);

-- RLS
ALTER TABLE public.amelia_learnings ENABLE ROW LEVEL SECURITY;

-- Read: authenticated users can read learnings for their empresa
CREATE POLICY "Users can read learnings"
  ON public.amelia_learnings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert: only via service_role (edge functions)
CREATE POLICY "Service role can insert learnings"
  ON public.amelia_learnings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Update: authenticated users can validate/reject
CREATE POLICY "Users can update learnings"
  ON public.amelia_learnings FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_amelia_learnings_updated_at
  BEFORE UPDATE ON public.amelia_learnings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add new notification types support (no enum change needed, notifications.tipo is TEXT)
