-- Enum para tipos de evento SGT
CREATE TYPE public.sgt_evento_tipo AS ENUM (
  'LEAD_NOVO',
  'ATUALIZACAO',
  'CARRINHO_ABANDONADO',
  'MQL',
  'SCORE_ATUALIZADO',
  'CLIQUE_OFERTA',
  'FUNIL_ATUALIZADO'
);

-- Enum para empresa
CREATE TYPE public.empresa_tipo AS ENUM ('TOKENIZA', 'BLUE');

-- Enum para status de processamento
CREATE TYPE public.sgt_event_status AS ENUM ('RECEBIDO', 'PROCESSADO', 'ERRO');

-- Tabela principal de eventos SGT
CREATE TABLE public.sgt_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  empresa empresa_tipo NOT NULL,
  evento sgt_evento_tipo NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  recebido_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de logs de auditoria
CREATE TABLE public.sgt_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.sgt_events(id) ON DELETE CASCADE,
  status sgt_event_status NOT NULL,
  mensagem TEXT,
  erro_stack TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_sgt_events_lead_id ON public.sgt_events(lead_id);
CREATE INDEX idx_sgt_events_empresa ON public.sgt_events(empresa);
CREATE INDEX idx_sgt_events_evento ON public.sgt_events(evento);
CREATE INDEX idx_sgt_events_recebido_em ON public.sgt_events(recebido_em);
CREATE INDEX idx_sgt_events_idempotency ON public.sgt_events(idempotency_key);
CREATE INDEX idx_sgt_event_logs_event_id ON public.sgt_event_logs(event_id);
CREATE INDEX idx_sgt_event_logs_status ON public.sgt_event_logs(status);

-- Enable RLS
ALTER TABLE public.sgt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sgt_event_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - apenas admins podem ver eventos (via dashboard)
CREATE POLICY "Admins can view all events"
ON public.sgt_events
FOR SELECT
USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Admins can view all event logs"
ON public.sgt_event_logs
FOR SELECT
USING (has_role(auth.uid(), 'ADMIN'::user_role));

-- Service role pode inserir (usado pela edge function)
CREATE POLICY "Service can insert events"
ON public.sgt_events
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update events"
ON public.sgt_events
FOR UPDATE
USING (true);

CREATE POLICY "Service can insert event logs"
ON public.sgt_event_logs
FOR INSERT
WITH CHECK (true);