
-- Fase 2: Adicionar use_count na knowledge_faq
ALTER TABLE public.knowledge_faq ADD COLUMN IF NOT EXISTS use_count integer NOT NULL DEFAULT 0;

-- Fase 3: Tabela knowledge_gaps
CREATE TABLE public.knowledge_gaps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa text NOT NULL,
  topic text NOT NULL,
  description text,
  frequency integer NOT NULL DEFAULT 1,
  sample_queries text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'ABERTO',
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.knowledge_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on knowledge_gaps"
ON public.knowledge_gaps FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can read knowledge_gaps"
ON public.knowledge_gaps FOR SELECT TO authenticated
USING (empresa IN (SELECT unnest(public.get_user_empresas(auth.uid()))));

CREATE POLICY "Authenticated users can update knowledge_gaps"
ON public.knowledge_gaps FOR UPDATE TO authenticated
USING (empresa IN (SELECT unnest(public.get_user_empresas(auth.uid()))));

-- Index for fast lookup by empresa + status
CREATE INDEX idx_knowledge_gaps_empresa_status ON public.knowledge_gaps(empresa, status);

-- Index for use_count on FAQ
CREATE INDEX idx_knowledge_faq_use_count ON public.knowledge_faq(use_count DESC);
