
-- 1. Drop the unique index that restricts one active number per empresa
DROP INDEX IF EXISTS idx_whatsapp_connections_empresa_active;

-- 2. Add label and is_default columns to whatsapp_connections
ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- 3. Set existing active connection as default
UPDATE public.whatsapp_connections SET is_default = true WHERE is_active = true;

-- 4. Unique index: only one default per empresa
CREATE UNIQUE INDEX idx_whatsapp_connections_empresa_default
  ON public.whatsapp_connections (empresa) WHERE is_default = true;

-- 5. Add from_phone_number_id to lead_messages for audit trail
ALTER TABLE public.lead_messages
  ADD COLUMN IF NOT EXISTS from_phone_number_id TEXT;
