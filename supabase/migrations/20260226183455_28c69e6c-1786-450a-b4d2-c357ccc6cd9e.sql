
-- ========================================
-- Fase 1: whatsapp_connections + colunas Meta em message_templates
-- ========================================

-- 1. Tabela whatsapp_connections
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa public.empresa_tipo NOT NULL,
  phone_number_id TEXT NOT NULL,
  business_account_id TEXT NOT NULL,
  display_phone TEXT,
  verified_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique: uma conexão ativa por empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_connections_empresa_active
  ON public.whatsapp_connections (empresa) WHERE is_active = true;

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "Authenticated users can read whatsapp_connections"
  ON public.whatsapp_connections FOR SELECT
  TO authenticated
  USING (true);

-- Only service_role / admin can manage (via edge functions)
CREATE POLICY "Service role can manage whatsapp_connections"
  ON public.whatsapp_connections FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Expandir message_templates com campos Meta
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS meta_template_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_status TEXT NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN IF NOT EXISTS meta_category TEXT,
  ADD COLUMN IF NOT EXISTS meta_language TEXT NOT NULL DEFAULT 'pt_BR',
  ADD COLUMN IF NOT EXISTS meta_components JSONB,
  ADD COLUMN IF NOT EXISTS meta_rejected_reason TEXT;

-- Index para filtro por meta_status
CREATE INDEX IF NOT EXISTS idx_message_templates_meta_status
  ON public.message_templates (meta_status);
