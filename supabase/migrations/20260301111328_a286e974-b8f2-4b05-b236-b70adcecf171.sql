ALTER TABLE public.knowledge_embeddings 
  DROP CONSTRAINT knowledge_embeddings_source_type_check;

ALTER TABLE public.knowledge_embeddings 
  ADD CONSTRAINT knowledge_embeddings_source_type_check 
  CHECK (source_type = ANY (ARRAY['section', 'faq', 'document', 'behavioral']));