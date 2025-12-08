-- PATCH 4 - Motor de Cadências
-- Tabelas: cadences, cadence_steps, lead_cadence_runs, lead_cadence_events

-- Enum para status de cadência
CREATE TYPE cadence_run_status AS ENUM ('ATIVA', 'CONCLUIDA', 'CANCELADA', 'PAUSADA');

-- Enum para tipo de evento de cadência
CREATE TYPE cadence_event_tipo AS ENUM ('AGENDADO', 'DISPARADO', 'ERRO', 'RESPOSTA_DETECTADA');

-- Enum para canal de comunicação
CREATE TYPE canal_tipo AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');

-- ========================================
-- Tabela: cadences (molde de cadência)
-- ========================================
CREATE TABLE public.cadences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa empresa_tipo NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  canal_principal canal_tipo NOT NULL DEFAULT 'WHATSAPP',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_cadences_updated_at
  BEFORE UPDATE ON public.cadences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.cadences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cadences"
  ON public.cadences FOR ALL
  USING (has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Marketing can view cadences"
  ON public.cadences FOR SELECT
  USING (has_role(auth.uid(), 'MARKETING'));

CREATE POLICY "SDR_IA can view cadences"
  ON public.cadences FOR SELECT
  USING (has_role(auth.uid(), 'SDR_IA'));

CREATE POLICY "Service can read cadences"
  ON public.cadences FOR SELECT
  USING (true);

-- ========================================
-- Tabela: cadence_steps (passos da cadência)
-- ========================================
CREATE TABLE public.cadence_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cadence_id UUID NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  ordem INT NOT NULL,
  offset_minutos INT NOT NULL DEFAULT 0,
  canal canal_tipo NOT NULL DEFAULT 'WHATSAPP',
  template_codigo TEXT NOT NULL,
  parar_se_responder BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cadence_id, ordem)
);

-- Trigger para updated_at
CREATE TRIGGER update_cadence_steps_updated_at
  BEFORE UPDATE ON public.cadence_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.cadence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cadence_steps"
  ON public.cadence_steps FOR ALL
  USING (has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Marketing can view cadence_steps"
  ON public.cadence_steps FOR SELECT
  USING (has_role(auth.uid(), 'MARKETING'));

CREATE POLICY "SDR_IA can view cadence_steps"
  ON public.cadence_steps FOR SELECT
  USING (has_role(auth.uid(), 'SDR_IA'));

CREATE POLICY "Service can read cadence_steps"
  ON public.cadence_steps FOR SELECT
  USING (true);

-- ========================================
-- Tabela: lead_cadence_runs (instância de cadência por lead)
-- ========================================
CREATE TABLE public.lead_cadence_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id TEXT NOT NULL,
  empresa empresa_tipo NOT NULL,
  cadence_id UUID NOT NULL REFERENCES public.cadences(id),
  status cadence_run_status NOT NULL DEFAULT 'ATIVA',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_step_ordem INT NOT NULL DEFAULT 0,
  next_step_ordem INT,
  next_run_at TIMESTAMP WITH TIME ZONE,
  classification_snapshot JSONB,
  fonte_evento_id UUID REFERENCES public.sgt_events(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_lead_cadence_runs_lead_empresa ON public.lead_cadence_runs(lead_id, empresa);
CREATE INDEX idx_lead_cadence_runs_status ON public.lead_cadence_runs(status);
CREATE INDEX idx_lead_cadence_runs_next_run_at ON public.lead_cadence_runs(next_run_at) WHERE status = 'ATIVA';

-- Trigger para updated_at
CREATE TRIGGER update_lead_cadence_runs_updated_at
  BEFORE UPDATE ON public.lead_cadence_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.lead_cadence_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage lead_cadence_runs"
  ON public.lead_cadence_runs FOR ALL
  USING (has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Marketing can view lead_cadence_runs"
  ON public.lead_cadence_runs FOR SELECT
  USING (has_role(auth.uid(), 'MARKETING'));

CREATE POLICY "SDR_IA can manage lead_cadence_runs"
  ON public.lead_cadence_runs FOR ALL
  USING (has_role(auth.uid(), 'SDR_IA'));

CREATE POLICY "Service can insert lead_cadence_runs"
  ON public.lead_cadence_runs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update lead_cadence_runs"
  ON public.lead_cadence_runs FOR UPDATE
  USING (true);

CREATE POLICY "Service can select lead_cadence_runs"
  ON public.lead_cadence_runs FOR SELECT
  USING (true);

-- ========================================
-- Tabela: lead_cadence_events (log de execução)
-- ========================================
CREATE TABLE public.lead_cadence_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_cadence_run_id UUID NOT NULL REFERENCES public.lead_cadence_runs(id) ON DELETE CASCADE,
  step_ordem INT NOT NULL,
  template_codigo TEXT NOT NULL,
  tipo_evento cadence_event_tipo NOT NULL,
  detalhes JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice
CREATE INDEX idx_lead_cadence_events_run_id ON public.lead_cadence_events(lead_cadence_run_id);

-- RLS
ALTER TABLE public.lead_cadence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view lead_cadence_events"
  ON public.lead_cadence_events FOR SELECT
  USING (has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Marketing can view lead_cadence_events"
  ON public.lead_cadence_events FOR SELECT
  USING (has_role(auth.uid(), 'MARKETING'));

CREATE POLICY "SDR_IA can manage lead_cadence_events"
  ON public.lead_cadence_events FOR ALL
  USING (has_role(auth.uid(), 'SDR_IA'));

CREATE POLICY "Service can insert lead_cadence_events"
  ON public.lead_cadence_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can select lead_cadence_events"
  ON public.lead_cadence_events FOR SELECT
  USING (true);

-- ========================================
-- SEED: Cadências iniciais
-- ========================================

-- Cadência: TOKENIZA_INBOUND_LEAD_NOVO
INSERT INTO public.cadences (empresa, codigo, nome, descricao, canal_principal) VALUES
('TOKENIZA', 'TOKENIZA_INBOUND_LEAD_NOVO', 'Inbound Lead Novo Tokeniza', 'Cadência para leads novos da Tokeniza via inbound', 'WHATSAPP');

INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder) VALUES
((SELECT id FROM public.cadences WHERE codigo = 'TOKENIZA_INBOUND_LEAD_NOVO'), 1, 0, 'WHATSAPP', 'TOKENIZA_INBOUND_DIA0', true),
((SELECT id FROM public.cadences WHERE codigo = 'TOKENIZA_INBOUND_LEAD_NOVO'), 2, 1440, 'WHATSAPP', 'TOKENIZA_INBOUND_DIA1', true),
((SELECT id FROM public.cadences WHERE codigo = 'TOKENIZA_INBOUND_LEAD_NOVO'), 3, 4320, 'WHATSAPP', 'TOKENIZA_INBOUND_DIA3', true);

-- Cadência: TOKENIZA_MQL_QUENTE
INSERT INTO public.cadences (empresa, codigo, nome, descricao, canal_principal) VALUES
('TOKENIZA', 'TOKENIZA_MQL_QUENTE', 'MQL Quente Tokeniza', 'Cadência para MQL quente ou carrinho abandonado da Tokeniza', 'WHATSAPP');

INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder) VALUES
((SELECT id FROM public.cadences WHERE codigo = 'TOKENIZA_MQL_QUENTE'), 1, 0, 'WHATSAPP', 'TOKENIZA_MQL_URGENTE_DIA0', true),
((SELECT id FROM public.cadences WHERE codigo = 'TOKENIZA_MQL_QUENTE'), 2, 120, 'WHATSAPP', 'TOKENIZA_MQL_FOLLOWUP_2H', true),
((SELECT id FROM public.cadences WHERE codigo = 'TOKENIZA_MQL_QUENTE'), 3, 1440, 'WHATSAPP', 'TOKENIZA_MQL_DIA1', true);

-- Cadência: BLUE_INBOUND_LEAD_NOVO
INSERT INTO public.cadences (empresa, codigo, nome, descricao, canal_principal) VALUES
('BLUE', 'BLUE_INBOUND_LEAD_NOVO', 'Inbound Lead Novo Blue', 'Cadência para leads novos da Blue via inbound', 'WHATSAPP');

INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder) VALUES
((SELECT id FROM public.cadences WHERE codigo = 'BLUE_INBOUND_LEAD_NOVO'), 1, 0, 'WHATSAPP', 'BLUE_INBOUND_DIA0', true),
((SELECT id FROM public.cadences WHERE codigo = 'BLUE_INBOUND_LEAD_NOVO'), 2, 1440, 'WHATSAPP', 'BLUE_INBOUND_DIA1', true),
((SELECT id FROM public.cadences WHERE codigo = 'BLUE_INBOUND_LEAD_NOVO'), 3, 2880, 'WHATSAPP', 'BLUE_INBOUND_DIA2', true);

-- Cadência: BLUE_IR_URGENTE
INSERT INTO public.cadences (empresa, codigo, nome, descricao, canal_principal) VALUES
('BLUE', 'BLUE_IR_URGENTE', 'IR Urgente Blue', 'Cadência urgente para alto ticket IR ou recorrente em época de IR', 'WHATSAPP');

INSERT INTO public.cadence_steps (cadence_id, ordem, offset_minutos, canal, template_codigo, parar_se_responder) VALUES
((SELECT id FROM public.cadences WHERE codigo = 'BLUE_IR_URGENTE'), 1, 0, 'WHATSAPP', 'BLUE_IR_URGENTE_DIA0', true),
((SELECT id FROM public.cadences WHERE codigo = 'BLUE_IR_URGENTE'), 2, 60, 'WHATSAPP', 'BLUE_IR_FOLLOWUP_1H', true),
((SELECT id FROM public.cadences WHERE codigo = 'BLUE_IR_URGENTE'), 3, 1440, 'WHATSAPP', 'BLUE_IR_DIA1', true);