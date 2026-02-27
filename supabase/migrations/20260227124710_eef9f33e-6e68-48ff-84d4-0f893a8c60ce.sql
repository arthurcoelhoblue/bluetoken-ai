
ALTER TABLE public.integration_company_config
  ADD COLUMN IF NOT EXISTS api_key TEXT,
  ADD COLUMN IF NOT EXISTS connection_name TEXT;
