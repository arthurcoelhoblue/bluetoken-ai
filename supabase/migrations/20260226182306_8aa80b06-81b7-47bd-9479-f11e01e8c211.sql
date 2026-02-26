
-- Fase 0: Expandir constraint de channel para incluir meta_cloud

-- 1. Dropar constraint antigo
ALTER TABLE public.integration_company_config
  DROP CONSTRAINT integration_company_config_channel_check;

-- 2. Recriar com meta_cloud
ALTER TABLE public.integration_company_config
  ADD CONSTRAINT integration_company_config_channel_check
  CHECK (channel = ANY (ARRAY['bluechat'::text, 'mensageria'::text, 'meta_cloud'::text]));

-- 3. Inserir rows meta_cloud (desabilitadas por padrão)
INSERT INTO public.integration_company_config (empresa, channel, enabled)
VALUES
  ('BLUE', 'meta_cloud', false),
  ('TOKENIZA', 'meta_cloud', false),
  ('MPUPPE', 'meta_cloud', false),
  ('AXIA', 'meta_cloud', false)
ON CONFLICT DO NOTHING;
