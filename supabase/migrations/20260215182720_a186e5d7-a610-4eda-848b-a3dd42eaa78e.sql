
-- Tabela para rate limiting de chamadas IA
CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  function_name text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  call_count int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, function_name, window_start)
);

-- Enable RLS
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: service role only (edge functions use service role key)
CREATE POLICY "Service role full access" ON public.ai_rate_limits
  FOR ALL USING (true) WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_ai_rate_limits_lookup ON public.ai_rate_limits (user_id, function_name, window_start);

-- Auto-cleanup old records (older than 24h)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.ai_rate_limits WHERE window_start < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
