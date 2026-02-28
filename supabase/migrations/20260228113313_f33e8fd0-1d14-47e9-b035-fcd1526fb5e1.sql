
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create knowledge_embeddings table
CREATE TABLE public.knowledge_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('section', 'faq', 'document')),
  source_id UUID NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding extensions.vector(1536),
  metadata JSONB DEFAULT '{}',
  empresa TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for fast similarity search
CREATE INDEX idx_knowledge_embeddings_embedding ON public.knowledge_embeddings 
  USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

-- Create index for filtering by empresa and source
CREATE INDEX idx_knowledge_embeddings_empresa ON public.knowledge_embeddings (empresa);
CREATE INDEX idx_knowledge_embeddings_source ON public.knowledge_embeddings (source_type, source_id);

-- Unique constraint to prevent duplicate chunks
CREATE UNIQUE INDEX idx_knowledge_embeddings_unique_chunk ON public.knowledge_embeddings (source_type, source_id, chunk_index);

-- Enable RLS
ALTER TABLE public.knowledge_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS policies: service role can do everything, authenticated users can read
CREATE POLICY "Service role full access on knowledge_embeddings"
  ON public.knowledge_embeddings FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read knowledge_embeddings"
  ON public.knowledge_embeddings FOR SELECT
  TO authenticated
  USING (true);

-- DB function for semantic search
CREATE OR REPLACE FUNCTION public.search_knowledge_embeddings(
  query_embedding extensions.vector(1536),
  p_empresa TEXT,
  p_top_k INT DEFAULT 5,
  p_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id UUID,
  chunk_text TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.source_type,
    ke.source_id,
    ke.chunk_text,
    ke.metadata,
    1 - (ke.embedding <=> query_embedding)::FLOAT AS similarity
  FROM public.knowledge_embeddings ke
  WHERE ke.empresa = p_empresa
    AND ke.embedding IS NOT NULL
    AND 1 - (ke.embedding <=> query_embedding)::FLOAT >= p_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT p_top_k;
END;
$$;
