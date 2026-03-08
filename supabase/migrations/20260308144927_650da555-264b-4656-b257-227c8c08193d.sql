-- Enable meta_cloud channel for BLUE_LABS
INSERT INTO integration_company_config (empresa, channel, enabled, connection_name, api_key)
VALUES ('BLUE_LABS'::empresa_tipo, 'meta_cloud', true, null, null)
ON CONFLICT (empresa, channel) DO UPDATE SET enabled = true, updated_at = now();