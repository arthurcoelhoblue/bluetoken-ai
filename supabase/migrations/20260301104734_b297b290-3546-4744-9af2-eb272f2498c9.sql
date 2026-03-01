
-- Create behavioral_knowledge table
CREATE TABLE public.behavioral_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL,
  titulo TEXT NOT NULL,
  autor TEXT,
  descricao TEXT,
  storage_path TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  chunks_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.behavioral_knowledge ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users with matching empresa can read
CREATE POLICY "Authenticated users can view behavioral_knowledge"
  ON public.behavioral_knowledge FOR SELECT
  USING (auth.uid() IS NOT NULL AND empresa IN (SELECT unnest(public.get_user_empresas(auth.uid()))));

CREATE POLICY "Authenticated users can insert behavioral_knowledge"
  ON public.behavioral_knowledge FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND empresa IN (SELECT unnest(public.get_user_empresas(auth.uid()))));

CREATE POLICY "Authenticated users can update behavioral_knowledge"
  ON public.behavioral_knowledge FOR UPDATE
  USING (auth.uid() IS NOT NULL AND empresa IN (SELECT unnest(public.get_user_empresas(auth.uid()))));

CREATE POLICY "Authenticated users can delete behavioral_knowledge"
  ON public.behavioral_knowledge FOR DELETE
  USING (auth.uid() IS NOT NULL AND empresa IN (SELECT unnest(public.get_user_empresas(auth.uid()))));

-- Service role full access
CREATE POLICY "Service role full access to behavioral_knowledge"
  ON public.behavioral_knowledge FOR ALL
  USING (auth.role() = 'service_role');

-- Create storage bucket for behavioral books (reuse knowledge-documents pattern)
INSERT INTO storage.buckets (id, name, public) VALUES ('behavioral-books', 'behavioral-books', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload behavioral books"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'behavioral-books' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read behavioral books"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'behavioral-books' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete behavioral books"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'behavioral-books' AND auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_behavioral_knowledge_updated_at
  BEFORE UPDATE ON public.behavioral_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
