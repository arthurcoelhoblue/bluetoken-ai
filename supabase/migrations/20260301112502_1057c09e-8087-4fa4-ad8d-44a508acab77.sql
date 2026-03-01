ALTER TABLE public.behavioral_knowledge 
  ADD COLUMN IF NOT EXISTS embed_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS embed_started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.behavioral_knowledge.embed_status IS 'pending | processing | done | error';
