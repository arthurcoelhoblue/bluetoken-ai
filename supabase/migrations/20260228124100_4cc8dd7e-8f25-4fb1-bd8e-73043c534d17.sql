
-- ============================================
-- RAG ML Enhancement: Hybrid Search + Feedback + Cache
-- ============================================

-- 1. Add FTS column to knowledge_embeddings
ALTER TABLE public.knowledge_embeddings ADD COLUMN IF NOT EXISTS fts tsvector;

-- 2. Create trigger to auto-populate fts on insert/update
CREATE OR REPLACE FUNCTION public.knowledge_embeddings_fts_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.fts := to_tsvector('portuguese', COALESCE(NEW.chunk_text, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_knowledge_embeddings_fts ON public.knowledge_embeddings;
CREATE TRIGGER trg_knowledge_embeddings_fts
  BEFORE INSERT OR UPDATE OF chunk_text ON public.knowledge_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.knowledge_embeddings_fts_update();

-- 3. GIN index on fts
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_fts ON public.knowledge_embeddings USING GIN (fts);

-- 4. Backfill existing rows
UPDATE public.knowledge_embeddings SET fts = to_tsvector('portuguese', COALESCE(chunk_text, '')) WHERE fts IS NULL;

-- ============================================
-- 5. knowledge_search_feedback table
-- ============================================
CREATE TABLE IF NOT EXISTS public.knowledge_search_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  expanded_query TEXT,
  chunks_returned JSONB DEFAULT '[]'::jsonb,
  search_method TEXT DEFAULT 'semantic',
  lead_id TEXT,
  empresa TEXT NOT NULL,
  outcome TEXT DEFAULT 'PENDENTE', -- UTIL, NAO_UTIL, PENDENTE
  outcome_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_search_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on feedback"
  ON public.knowledge_search_feedback
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_feedback_empresa_created ON public.knowledge_search_feedback (empresa, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_outcome ON public.knowledge_search_feedback (outcome);

-- ============================================
-- 6. knowledge_query_cache table
-- ============================================
CREATE TABLE IF NOT EXISTS public.knowledge_query_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_hash TEXT NOT NULL UNIQUE,
  original_query TEXT NOT NULL,
  expanded_query TEXT NOT NULL,
  embedding vector(1536),
  empresa TEXT NOT NULL,
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.knowledge_query_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on cache"
  ON public.knowledge_query_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_cache_hash ON public.knowledge_query_cache (query_hash);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON public.knowledge_query_cache (expires_at);

-- ============================================
-- 7. Hybrid Search function with RRF
-- ============================================
CREATE OR REPLACE FUNCTION public.hybrid_search_knowledge(
  query_embedding vector(1536),
  query_text TEXT,
  p_empresa TEXT,
  p_top_k INTEGER DEFAULT 10,
  p_threshold FLOAT DEFAULT 0.2,
  p_rrf_k INTEGER DEFAULT 60
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id UUID,
  chunk_text TEXT,
  metadata JSONB,
  similarity FLOAT,
  rrf_score FLOAT,
  search_source TEXT
)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_tsquery tsquery;
BEGIN
  -- Build tsquery from query_text (portuguese)
  v_tsquery := plainto_tsquery('portuguese', query_text);

  RETURN QUERY
  WITH
  -- Vector search: top candidates by cosine similarity
  vector_results AS (
    SELECT
      ke.id,
      ke.source_type,
      ke.source_id,
      ke.chunk_text,
      ke.metadata,
      (1 - (ke.embedding <=> query_embedding))::FLOAT AS sim,
      ROW_NUMBER() OVER (ORDER BY ke.embedding <=> query_embedding) AS vrank
    FROM public.knowledge_embeddings ke
    WHERE ke.empresa = p_empresa
      AND ke.embedding IS NOT NULL
      AND (1 - (ke.embedding <=> query_embedding))::FLOAT >= p_threshold
    ORDER BY ke.embedding <=> query_embedding
    LIMIT p_top_k * 2
  ),
  -- Full-text search: top candidates by ts_rank
  fts_results AS (
    SELECT
      ke.id,
      ke.source_type,
      ke.source_id,
      ke.chunk_text,
      ke.metadata,
      ts_rank_cd(ke.fts, v_tsquery)::FLOAT AS fts_rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(ke.fts, v_tsquery) DESC) AS frank
    FROM public.knowledge_embeddings ke
    WHERE ke.empresa = p_empresa
      AND ke.fts IS NOT NULL
      AND ke.fts @@ v_tsquery
    ORDER BY ts_rank_cd(ke.fts, v_tsquery) DESC
    LIMIT p_top_k * 2
  ),
  -- Reciprocal Rank Fusion
  combined AS (
    SELECT
      COALESCE(v.id, f.id) AS id,
      COALESCE(v.source_type, f.source_type) AS source_type,
      COALESCE(v.source_id, f.source_id) AS source_id,
      COALESCE(v.chunk_text, f.chunk_text) AS chunk_text,
      COALESCE(v.metadata, f.metadata) AS metadata,
      COALESCE(v.sim, 0)::FLOAT AS similarity,
      (
        COALESCE(1.0 / (p_rrf_k + v.vrank), 0) +
        COALESCE(1.0 / (p_rrf_k + f.frank), 0)
      )::FLOAT AS rrf_score,
      CASE
        WHEN v.id IS NOT NULL AND f.id IS NOT NULL THEN 'hybrid'
        WHEN v.id IS NOT NULL THEN 'vector'
        ELSE 'fts'
      END AS search_source
    FROM vector_results v
    FULL OUTER JOIN fts_results f ON v.id = f.id
  )
  SELECT
    combined.id,
    combined.source_type,
    combined.source_id,
    combined.chunk_text,
    combined.metadata,
    combined.similarity,
    combined.rrf_score,
    combined.search_source
  FROM combined
  ORDER BY combined.rrf_score DESC
  LIMIT p_top_k;
END;
$$;

-- ============================================
-- 8. Add suggested_faq_id to knowledge_gaps for auto-resolution tracking
-- ============================================
ALTER TABLE public.knowledge_gaps ADD COLUMN IF NOT EXISTS suggested_faq_id UUID;
ALTER TABLE public.knowledge_gaps ADD COLUMN IF NOT EXISTS auto_suggested_at TIMESTAMPTZ;
