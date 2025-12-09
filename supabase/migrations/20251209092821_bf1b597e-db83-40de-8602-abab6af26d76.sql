-- ========================================
-- PATCH 5G - SDR IA Engine
-- Tabela para armazenar interpretações de IA
-- ========================================

-- Criar enum para tipos de intenção do lead
CREATE TYPE lead_intent_tipo AS ENUM (
  'INTERESSE_COMPRA',
  'DUVIDA_PRODUTO',
  'DUVIDA_PRECO',
  'SOLICITACAO_CONTATO',
  'AGENDAMENTO_REUNIAO',
  'RECLAMACAO',
  'OPT_OUT',
  'NAO_ENTENDI',
  'CUMPRIMENTO',
  'AGRADECIMENTO',
  'FORA_CONTEXTO',
  'OUTRO'
);

-- Criar enum para ações do SDR IA
CREATE TYPE sdr_acao_tipo AS ENUM (
  'PAUSAR_CADENCIA',
  'CANCELAR_CADENCIA',
  'RETOMAR_CADENCIA',
  'AJUSTAR_TEMPERATURA',
  'CRIAR_TAREFA_CLOSER',
  'MARCAR_OPT_OUT',
  'NENHUMA',
  'ESCALAR_HUMANO'
);

-- Tabela de interpretações de mensagens
CREATE TABLE public.lead_message_intents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.lead_messages(id) ON DELETE CASCADE,
  lead_id TEXT,
  run_id UUID REFERENCES public.lead_cadence_runs(id) ON DELETE SET NULL,
  empresa empresa_tipo NOT NULL,
  
  -- Interpretação da IA
  intent lead_intent_tipo NOT NULL,
  intent_confidence NUMERIC(5,4) NOT NULL CHECK (intent_confidence >= 0 AND intent_confidence <= 1),
  intent_summary TEXT,
  
  -- Ação recomendada/aplicada
  acao_recomendada sdr_acao_tipo NOT NULL DEFAULT 'NENHUMA',
  acao_aplicada BOOLEAN NOT NULL DEFAULT false,
  acao_detalhes JSONB,
  
  -- Metadados
  modelo_ia TEXT,
  tokens_usados INTEGER,
  tempo_processamento_ms INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_lead_message_intents_message_id ON public.lead_message_intents(message_id);
CREATE INDEX idx_lead_message_intents_lead_id ON public.lead_message_intents(lead_id);
CREATE INDEX idx_lead_message_intents_run_id ON public.lead_message_intents(run_id);
CREATE INDEX idx_lead_message_intents_created_at ON public.lead_message_intents(created_at DESC);
CREATE INDEX idx_lead_message_intents_intent ON public.lead_message_intents(intent);
CREATE INDEX idx_lead_message_intents_acao ON public.lead_message_intents(acao_recomendada) WHERE acao_aplicada = false;

-- RLS
ALTER TABLE public.lead_message_intents ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Admins can manage lead_message_intents"
  ON public.lead_message_intents
  FOR ALL
  USING (has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Marketing can view lead_message_intents"
  ON public.lead_message_intents
  FOR SELECT
  USING (has_role(auth.uid(), 'MARKETING'));

CREATE POLICY "SDR_IA can manage lead_message_intents"
  ON public.lead_message_intents
  FOR ALL
  USING (has_role(auth.uid(), 'SDR_IA'));

CREATE POLICY "Service can manage lead_message_intents"
  ON public.lead_message_intents
  FOR ALL
  USING (true);

-- Comentários
COMMENT ON TABLE public.lead_message_intents IS 'Armazena interpretações de IA para mensagens inbound';
COMMENT ON COLUMN public.lead_message_intents.intent IS 'Intenção detectada pela IA';
COMMENT ON COLUMN public.lead_message_intents.intent_confidence IS 'Confiança da IA (0-1)';
COMMENT ON COLUMN public.lead_message_intents.acao_recomendada IS 'Ação sugerida pela IA';
COMMENT ON COLUMN public.lead_message_intents.acao_aplicada IS 'Se a ação foi executada';