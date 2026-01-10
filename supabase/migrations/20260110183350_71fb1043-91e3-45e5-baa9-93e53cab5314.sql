-- =============================================
-- PATCH: Email modo teste + Closer notifications
-- =============================================

-- 1. Adicionar configuração de modo de teste do Email
INSERT INTO system_settings (category, key, value, description)
VALUES ('email', 'modo_teste', 
  '{"ativo": true, "email_teste": "admin@grupoblue.com.br"}'::jsonb, 
  'Configuração de modo de teste do Email')
ON CONFLICT (category, key) DO NOTHING;

-- 2. Criar tabela de notificações para closers
CREATE TABLE IF NOT EXISTS public.closer_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  empresa public.empresa_tipo NOT NULL,
  closer_email TEXT,
  motivo TEXT NOT NULL,
  contexto JSONB,
  enviado_em TIMESTAMPTZ,
  visualizado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Comentário da tabela
COMMENT ON TABLE public.closer_notifications IS 'Notificações enviadas para closers sobre leads quentes';

-- Índices para consultas
CREATE INDEX IF NOT EXISTS idx_closer_notifications_lead ON public.closer_notifications(lead_id, empresa);
CREATE INDEX IF NOT EXISTS idx_closer_notifications_closer ON public.closer_notifications(closer_email);
CREATE INDEX IF NOT EXISTS idx_closer_notifications_pending ON public.closer_notifications(visualizado_em) WHERE visualizado_em IS NULL;

-- RLS
ALTER TABLE public.closer_notifications ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ver notificações
CREATE POLICY "Authenticated users can view notifications"
  ON public.closer_notifications FOR SELECT
  TO authenticated USING (true);

-- Política: usuários autenticados podem atualizar (marcar como visualizado)
CREATE POLICY "Authenticated users can update notifications"
  ON public.closer_notifications FOR UPDATE
  TO authenticated USING (true);

-- Política: service role pode inserir
CREATE POLICY "Service role can insert notifications"
  ON public.closer_notifications FOR INSERT
  TO service_role WITH CHECK (true);