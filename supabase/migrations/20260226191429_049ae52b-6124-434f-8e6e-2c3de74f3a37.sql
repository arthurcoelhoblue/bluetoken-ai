
-- Fase 4: Colunas de mídia em lead_messages
ALTER TABLE public.lead_messages
  ADD COLUMN IF NOT EXISTS tipo_midia TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS media_filename TEXT,
  ADD COLUMN IF NOT EXISTS media_caption TEXT,
  ADD COLUMN IF NOT EXISTS media_meta_id TEXT;

-- Índice para buscar por media_meta_id (download dedup)
CREATE INDEX IF NOT EXISTS idx_lead_messages_media_meta_id ON public.lead_messages (media_meta_id) WHERE media_meta_id IS NOT NULL;

-- Storage bucket para mídia do WhatsApp
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: qualquer um pode ler (bucket público)
CREATE POLICY "Public read access for whatsapp-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- RLS: service_role pode inserir (via edge functions)
CREATE POLICY "Service role insert for whatsapp-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media');

-- RLS: service_role pode deletar
CREATE POLICY "Service role delete for whatsapp-media"
ON storage.objects FOR DELETE
USING (bucket_id = 'whatsapp-media');
