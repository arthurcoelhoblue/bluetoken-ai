-- ========================================
-- PATCH 3 - Pipeline de Classificação Comercial
-- ========================================

-- Enum para temperatura
CREATE TYPE public.temperatura_tipo AS ENUM ('FRIO', 'MORNO', 'QUENTE');

-- Enum para ICP
CREATE TYPE public.icp_tipo AS ENUM (
  'TOKENIZA_SERIAL',
  'TOKENIZA_MEDIO_PRAZO',
  'TOKENIZA_EMERGENTE',
  'TOKENIZA_ALTO_VOLUME_DIGITAL',
  'TOKENIZA_NAO_CLASSIFICADO',
  'BLUE_ALTO_TICKET_IR',
  'BLUE_RECURRENTE',
  'BLUE_PERDIDO_RECUPERAVEL',
  'BLUE_NAO_CLASSIFICADO'
);

-- Enum para Persona
CREATE TYPE public.persona_tipo AS ENUM (
  'CONSTRUTOR_PATRIMONIO',
  'COLECIONADOR_DIGITAL',
  'INICIANTE_CAUTELOSO',
  'CRIPTO_CONTRIBUINTE_URGENTE',
  'CLIENTE_FIEL_RENOVADOR',
  'LEAD_PERDIDO_RECUPERAVEL'
);

-- Tabela de classificações
CREATE TABLE public.lead_classifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id TEXT NOT NULL,
  empresa public.empresa_tipo NOT NULL,
  icp public.icp_tipo NOT NULL,
  persona public.persona_tipo,
  temperatura public.temperatura_tipo NOT NULL DEFAULT 'FRIO',
  prioridade INTEGER NOT NULL CHECK (prioridade IN (1, 2, 3)),
  score_interno INTEGER CHECK (score_interno >= 0 AND score_interno <= 100),
  fonte_evento_id UUID REFERENCES public.sgt_events(id),
  fonte_evento_tipo public.sgt_evento_tipo,
  classificado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraint: um lead por empresa
  UNIQUE(lead_id, empresa)
);

-- Índices para performance
CREATE INDEX idx_lead_classifications_lead_id ON public.lead_classifications(lead_id);
CREATE INDEX idx_lead_classifications_empresa ON public.lead_classifications(empresa);
CREATE INDEX idx_lead_classifications_temperatura ON public.lead_classifications(temperatura);
CREATE INDEX idx_lead_classifications_prioridade ON public.lead_classifications(prioridade);
CREATE INDEX idx_lead_classifications_icp ON public.lead_classifications(icp);

-- Trigger para updated_at
CREATE TRIGGER update_lead_classifications_updated_at
  BEFORE UPDATE ON public.lead_classifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.lead_classifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can view all classifications"
  ON public.lead_classifications
  FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Marketing can view classifications"
  ON public.lead_classifications
  FOR SELECT
  USING (public.has_role(auth.uid(), 'MARKETING'));

CREATE POLICY "SDR_IA can view and manage classifications"
  ON public.lead_classifications
  FOR ALL
  USING (public.has_role(auth.uid(), 'SDR_IA'));

CREATE POLICY "Service can insert classifications"
  ON public.lead_classifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update classifications"
  ON public.lead_classifications
  FOR UPDATE
  USING (true);