
-- Fix: restrict write access to service_role only
DROP POLICY "Service role full access on knowledge_embeddings" ON public.knowledge_embeddings;

CREATE POLICY "Service role can manage knowledge_embeddings"
  ON public.knowledge_embeddings FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
