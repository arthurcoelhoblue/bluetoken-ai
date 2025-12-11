-- Enum para tipos de seção de conhecimento
CREATE TYPE knowledge_section_tipo AS ENUM (
  'FAQ', 
  'OBJECOES', 
  'PITCH', 
  'RISCOS', 
  'ESTRUTURA_JURIDICA', 
  'GERAL'
);

-- Tabela principal de produtos
CREATE TABLE public.product_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa public.empresa_tipo NOT NULL,
  produto_id TEXT NOT NULL,
  produto_nome TEXT NOT NULL,
  descricao_curta TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa, produto_id)
);

-- Seções de conhecimento (usado pelo SDR)
CREATE TABLE public.knowledge_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_knowledge_id UUID NOT NULL REFERENCES public.product_knowledge(id) ON DELETE CASCADE,
  tipo knowledge_section_tipo NOT NULL,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_knowledge_id, tipo, titulo)
);

-- Documentos de referência
CREATE TABLE public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_knowledge_id UUID NOT NULL REFERENCES public.product_knowledge(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tipo_documento TEXT,
  descricao TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_knowledge
CREATE POLICY "Admins can manage product_knowledge" 
ON public.product_knowledge FOR ALL 
USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "SDR_IA can view product_knowledge" 
ON public.product_knowledge FOR SELECT 
USING (public.has_role(auth.uid(), 'SDR_IA'));

CREATE POLICY "Service can read product_knowledge" 
ON public.product_knowledge FOR SELECT 
USING (true);

-- RLS Policies for knowledge_sections
CREATE POLICY "Admins can manage knowledge_sections" 
ON public.knowledge_sections FOR ALL 
USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "SDR_IA can view knowledge_sections" 
ON public.knowledge_sections FOR SELECT 
USING (public.has_role(auth.uid(), 'SDR_IA'));

CREATE POLICY "Service can read knowledge_sections" 
ON public.knowledge_sections FOR SELECT 
USING (true);

-- RLS Policies for knowledge_documents
CREATE POLICY "Admins can manage knowledge_documents" 
ON public.knowledge_documents FOR ALL 
USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Service can read knowledge_documents" 
ON public.knowledge_documents FOR SELECT 
USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_product_knowledge_updated_at
BEFORE UPDATE ON public.product_knowledge
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_knowledge_sections_updated_at
BEFORE UPDATE ON public.knowledge_sections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for product documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-documents', 'product-documents', false);

-- Storage policies
CREATE POLICY "Admins can upload product documents" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'product-documents' AND public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can view product documents" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'product-documents' AND public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can delete product documents" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'product-documents' AND public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can update product documents" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'product-documents' AND public.has_role(auth.uid(), 'ADMIN'));