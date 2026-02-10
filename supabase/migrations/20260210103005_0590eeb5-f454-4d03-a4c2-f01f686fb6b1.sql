
-- Add per-company bluechat settings
INSERT INTO public.system_settings (category, key, value, description)
VALUES 
  ('integrations', 'bluechat_tokeniza', '{"api_url": "https://chat.grupoblue.com.br/api/external-ai", "enabled": true}'::jsonb, 'Configuração Blue Chat para Tokeniza'),
  ('integrations', 'bluechat_blue', '{"api_url": "", "enabled": true}'::jsonb, 'Configuração Blue Chat para Blue')
ON CONFLICT DO NOTHING;
