
-- Tabela de FAQ colaborativa para a Base de Conhecimento
CREATE TABLE public.knowledge_faq (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL DEFAULT 'TOKENIZA',
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  categoria TEXT DEFAULT 'Outros',
  tags TEXT[] DEFAULT '{}',
  fonte TEXT NOT NULL DEFAULT 'MANUAL',
  status TEXT NOT NULL DEFAULT 'RASCUNHO',
  motivo_rejeicao TEXT,
  criado_por UUID REFERENCES public.profiles(id),
  aprovado_por UUID REFERENCES public.profiles(id),
  aprovado_em TIMESTAMPTZ,
  produto_id UUID REFERENCES public.product_knowledge(id) ON DELETE SET NULL,
  visivel_amelia BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_knowledge_faq_status ON public.knowledge_faq(status);
CREATE INDEX idx_knowledge_faq_empresa ON public.knowledge_faq(empresa);
CREATE INDEX idx_knowledge_faq_criado_por ON public.knowledge_faq(criado_por);
CREATE INDEX idx_knowledge_faq_visivel ON public.knowledge_faq(visivel_amelia) WHERE visivel_amelia = true;

-- Trigger updated_at
CREATE TRIGGER update_knowledge_faq_updated_at
  BEFORE UPDATE ON public.knowledge_faq
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.knowledge_faq ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users
CREATE POLICY "Authenticated users can view FAQ items"
  ON public.knowledge_faq FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: authenticated users (must set criado_por = self)
CREATE POLICY "Authenticated users can create FAQ items"
  ON public.knowledge_faq FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND criado_por = auth.uid());

-- UPDATE: author (if RASCUNHO) or ADMIN/gestor for moderation
CREATE POLICY "Authors and moderators can update FAQ items"
  ON public.knowledge_faq FOR UPDATE
  USING (auth.uid() IS NOT NULL AND (
    (criado_por = auth.uid() AND status = 'RASCUNHO')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'ADMIN')
    OR auth.uid() IN (SELECT gestor_id FROM public.profiles WHERE id = knowledge_faq.criado_por AND gestor_id IS NOT NULL)
  ));

-- DELETE: author (if RASCUNHO) or ADMIN
CREATE POLICY "Authors and admins can delete FAQ items"
  ON public.knowledge_faq FOR DELETE
  USING (auth.uid() IS NOT NULL AND (
    (criado_por = auth.uid() AND status = 'RASCUNHO')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'ADMIN')
  ));
