
-- Rate limiting table for public webhooks
CREATE TABLE public.webhook_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name text NOT NULL,
  identifier text NOT NULL,
  window_start timestamptz NOT NULL,
  call_count int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for upsert
ALTER TABLE public.webhook_rate_limits 
  ADD CONSTRAINT webhook_rate_limits_fn_id_window_key 
  UNIQUE (function_name, identifier, window_start);

-- Index for cleanup queries
CREATE INDEX idx_webhook_rate_limits_window 
  ON public.webhook_rate_limits (window_start);

-- No RLS - only accessed via service_role from edge functions
ALTER TABLE public.webhook_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role can access
