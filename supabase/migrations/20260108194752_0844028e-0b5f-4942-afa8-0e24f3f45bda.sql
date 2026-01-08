-- Adicionar configurações de IA e WhatsApp
INSERT INTO system_settings (category, key, value, description) VALUES
('ia', 'model_priority', '{"ordem": ["ANTHROPIC", "GEMINI", "GPT"], "modelos": {"ANTHROPIC": "claude-sonnet-4-20250514", "GEMINI": "google/gemini-2.5-flash", "GPT": "openai/gpt-5-mini"}, "desabilitados": []}', 'Ordem de prioridade dos modelos de IA'),
('ia', 'custos', '{"precos_por_1k_tokens": {"ANTHROPIC": {"input": 0.003, "output": 0.015}, "GEMINI": {"input": 0.000125, "output": 0.0005}, "GPT": {"input": 0.00015, "output": 0.0006}}}', 'Custos estimados por token'),
('whatsapp', 'modo_teste', '{"ativo": true, "numero_teste": "5581987580922"}', 'Configuração de modo de teste do WhatsApp')
ON CONFLICT (category, key) DO NOTHING;