ALTER TABLE cs_customers 
  ADD COLUMN IF NOT EXISTS sgt_dados_extras JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sgt_last_sync_at TIMESTAMPTZ;