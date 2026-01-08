-- Tabela para armazenar configurações públicas do sistema
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id),
  UNIQUE(category, key)
);

-- Habilitar RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Apenas ADMIN pode gerenciar configurações
CREATE POLICY "Admin pode gerenciar configurações"
  ON public.system_settings FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::user_role));

-- Service pode ler configurações (para edge functions)
CREATE POLICY "Service pode ler configurações"
  ON public.system_settings FOR SELECT
  USING (true);

-- Inserir configurações padrão
INSERT INTO public.system_settings (category, key, value, description) VALUES
  ('amelia', 'horario_funcionamento', '{"inicio": "08:00", "fim": "18:00", "dias": ["seg", "ter", "qua", "qui", "sex"]}', 'Horário de funcionamento da Amélia'),
  ('amelia', 'limites_mensagens', '{"max_por_dia": 10, "intervalo_minutos": 30}', 'Limites de envio de mensagens'),
  ('amelia', 'comportamento', '{"tom": "profissional", "auto_escalar_apos": 5, "qualificacao_automatica": true}', 'Comportamento da Amélia'),
  ('integrations', 'whatsapp', '{"enabled": true, "provider": "mensageria"}', 'Configuração WhatsApp'),
  ('integrations', 'pipedrive', '{"enabled": false, "sync_interval_minutes": 60}', 'Configuração Pipedrive'),
  ('integrations', 'email', '{"enabled": true, "provider": "smtp"}', 'Configuração Email'),
  ('integrations', 'bluechat', '{"enabled": true}', 'Configuração Blue Chat');