ALTER TABLE public.whatsapp_connections 
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS app_secret text;