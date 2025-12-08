-- =============================================
-- PATCH 5B - Tabela lead_messages (Log Centralizado)
-- =============================================

-- Criar tabela de mensagens
CREATE TABLE public.lead_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  empresa empresa_tipo NOT NULL,
  run_id UUID REFERENCES lead_cadence_runs(id) ON DELETE SET NULL,
  step_ordem INTEGER,
  
  -- Direção e canal
  canal canal_tipo NOT NULL,
  direcao TEXT NOT NULL CHECK (direcao IN ('OUTBOUND', 'INBOUND')),
  
  -- Conteúdo
  template_codigo TEXT,
  conteudo TEXT NOT NULL,
  
  -- Estado
  estado TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (estado IN (
    'PENDENTE', 'ENVIADO', 'ENTREGUE', 'LIDO', 'ERRO', 'RECEBIDO'
  )),
  erro_detalhe TEXT,
  
  -- IDs externos
  whatsapp_message_id TEXT,
  email_message_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_em TIMESTAMPTZ,
  entregue_em TIMESTAMPTZ,
  lido_em TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX idx_lead_messages_lead ON lead_messages(lead_id, empresa);
CREATE INDEX idx_lead_messages_run ON lead_messages(run_id);
CREATE INDEX idx_lead_messages_estado ON lead_messages(estado);
CREATE INDEX idx_lead_messages_created ON lead_messages(created_at DESC);

-- Trigger para updated_at
CREATE TRIGGER update_lead_messages_updated_at
  BEFORE UPDATE ON lead_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE lead_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage lead_messages"
  ON lead_messages FOR ALL
  USING (has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Marketing can view lead_messages"
  ON lead_messages FOR SELECT
  USING (has_role(auth.uid(), 'MARKETING'));

CREATE POLICY "SDR_IA can manage lead_messages"
  ON lead_messages FOR ALL
  USING (has_role(auth.uid(), 'SDR_IA'));

CREATE POLICY "Service can manage lead_messages"
  ON lead_messages FOR ALL
  USING (true);

-- Comentários
COMMENT ON TABLE lead_messages IS 'Log centralizado de mensagens enviadas e recebidas';
COMMENT ON COLUMN lead_messages.direcao IS 'OUTBOUND = enviada pelo sistema, INBOUND = recebida do lead';
COMMENT ON COLUMN lead_messages.estado IS 'PENDENTE → ENVIADO → ENTREGUE → LIDO ou ERRO';