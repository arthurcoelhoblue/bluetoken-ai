
-- Update hybrid_search_knowledge to accept p_source_type_filter and ignore empresa for behavioral
CREATE OR REPLACE FUNCTION public.hybrid_search_knowledge(
  query_embedding extensions.vector,
  query_text text,
  p_empresa text,
  p_top_k integer DEFAULT 10,
  p_threshold double precision DEFAULT 0.2,
  p_rrf_k integer DEFAULT 60,
  p_source_type_filter text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  source_type text,
  source_id text,
  chunk_text text,
  metadata jsonb,
  similarity float,
  rrf_score float,
  search_source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tsquery tsquery;
BEGIN
  v_tsquery := plainto_tsquery('portuguese', query_text);

  RETURN QUERY
  WITH
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
    WHERE (p_source_type_filter IS NULL OR ke.source_type = p_source_type_filter)
      AND (ke.source_type = 'behavioral' OR ke.empresa = p_empresa)
      AND ke.embedding IS NOT NULL
      AND (1 - (ke.embedding <=> query_embedding))::FLOAT >= p_threshold
    ORDER BY ke.embedding <=> query_embedding
    LIMIT p_top_k * 2
  ),
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
    WHERE (p_source_type_filter IS NULL OR ke.source_type = p_source_type_filter)
      AND (ke.source_type = 'behavioral' OR ke.empresa = p_empresa)
      AND ke.fts IS NOT NULL
      AND ke.fts @@ v_tsquery
    ORDER BY ts_rank_cd(ke.fts, v_tsquery) DESC
    LIMIT p_top_k * 2
  ),
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

-- Update search_knowledge_embeddings to ignore empresa for behavioral
CREATE OR REPLACE FUNCTION public.search_knowledge_embeddings(
  query_embedding extensions.vector,
  p_empresa text,
  p_top_k integer DEFAULT 5,
  p_threshold double precision DEFAULT 0.3,
  p_source_type_filter text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  source_type text,
  source_id text,
  chunk_text text,
  metadata jsonb,
  similarity float
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
  WHERE (p_source_type_filter IS NULL OR ke.source_type = p_source_type_filter)
    AND (ke.source_type = 'behavioral' OR ke.empresa = p_empresa)
    AND ke.embedding IS NOT NULL
    AND 1 - (ke.embedding <=> query_embedding)::FLOAT >= p_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT p_top_k;
END;
$$;
