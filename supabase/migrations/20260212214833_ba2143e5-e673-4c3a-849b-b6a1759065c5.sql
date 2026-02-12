
-- =============================================
-- PATCH 1: Pipeline Kanban + CRM Data Model
-- =============================================

-- 1. PIPELINES
CREATE TABLE public.pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa public.empresa_tipo NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pipelines" ON public.pipelines FOR SELECT USING (true);
CREATE POLICY "Admins can manage pipelines" ON public.pipelines FOR ALL USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE TRIGGER update_pipelines_updated_at BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. PIPELINE_STAGES
CREATE TABLE public.pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  posicao INTEGER NOT NULL,
  cor TEXT NOT NULL DEFAULT '#6366f1',
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  sla_minutos INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id, posicao),
  CONSTRAINT stages_not_won_and_lost CHECK (NOT (is_won AND is_lost))
);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pipeline_stages" ON public.pipeline_stages FOR SELECT USING (true);
CREATE POLICY "Admins can manage pipeline_stages" ON public.pipeline_stages FOR ALL USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE TRIGGER update_pipeline_stages_updated_at BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. CONTACTS
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id UUID REFERENCES public.pessoas(id),
  empresa public.empresa_tipo NOT NULL,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  owner_id UUID REFERENCES public.profiles(id),
  tags TEXT[] DEFAULT '{}',
  tipo TEXT DEFAULT 'LEAD',
  canal_origem TEXT,
  legacy_lead_id TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contacts" ON public.contacts FOR SELECT USING (true);
CREATE POLICY "Admins can manage contacts" ON public.contacts FOR ALL USING (has_role(auth.uid(), 'ADMIN'::user_role));
CREATE POLICY "Closers can manage contacts" ON public.contacts FOR ALL USING (has_role(auth.uid(), 'CLOSER'::user_role));

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. DEALS
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id),
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id),
  titulo TEXT NOT NULL,
  valor NUMERIC(15,2) DEFAULT 0,
  moeda TEXT NOT NULL DEFAULT 'BRL',
  owner_id UUID REFERENCES public.profiles(id),
  temperatura public.temperatura_tipo DEFAULT 'FRIO',
  posicao_kanban INTEGER NOT NULL DEFAULT 0,
  fechado_em TIMESTAMPTZ,
  motivo_perda TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view deals" ON public.deals FOR SELECT USING (true);
CREATE POLICY "Admins can manage deals" ON public.deals FOR ALL USING (has_role(auth.uid(), 'ADMIN'::user_role));
CREATE POLICY "Closers can manage deals" ON public.deals FOR ALL USING (has_role(auth.uid(), 'CLOSER'::user_role));

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. DEAL_STAGE_HISTORY
CREATE TABLE public.deal_stage_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES public.pipeline_stages(id),
  to_stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id),
  moved_by UUID REFERENCES public.profiles(id),
  tempo_no_stage_anterior_ms BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view deal_stage_history" ON public.deal_stage_history FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert deal_stage_history" ON public.deal_stage_history FOR INSERT WITH CHECK (true);

-- 6. TRIGGER: log_deal_stage_change
CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tempo BIGINT;
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    -- Calculate time in previous stage (milliseconds)
    SELECT EXTRACT(EPOCH FROM (now() - COALESCE(
      (SELECT MAX(created_at) FROM deal_stage_history WHERE deal_id = NEW.id),
      OLD.updated_at
    ))) * 1000 INTO v_tempo;

    INSERT INTO deal_stage_history (deal_id, from_stage_id, to_stage_id, tempo_no_stage_anterior_ms)
    VALUES (NEW.id, OLD.stage_id, NEW.stage_id, v_tempo);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deal_stage_change
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_deal_stage_change();

-- 7. INDEXES
CREATE INDEX idx_deals_pipeline_stage ON public.deals(pipeline_id, stage_id) WHERE fechado_em IS NULL;
CREATE INDEX idx_deals_owner ON public.deals(owner_id) WHERE fechado_em IS NULL;
CREATE INDEX idx_contacts_empresa ON public.contacts(empresa);
CREATE INDEX idx_contacts_nome ON public.contacts(nome);
CREATE INDEX idx_contacts_email ON public.contacts(email) WHERE email IS NOT NULL;
CREATE INDEX idx_contacts_telefone ON public.contacts(telefone) WHERE telefone IS NOT NULL;
CREATE INDEX idx_deal_stage_history_deal ON public.deal_stage_history(deal_id);
CREATE INDEX idx_pipelines_empresa ON public.pipelines(empresa);

-- 8. SEED DATA

-- Blue pipeline
INSERT INTO public.pipelines (id, empresa, nome, descricao, is_default) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'BLUE', 'Novos Negócios', 'Pipeline principal da Blue Consult', true);

INSERT INTO public.pipeline_stages (pipeline_id, nome, posicao, cor, is_won, is_lost) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Lead', 1, '#94a3b8', false, false),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Contato Iniciado', 2, '#60a5fa', false, false),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Negociação', 3, '#f59e0b', false, false),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Aguardando Pagamento', 4, '#a78bfa', false, false),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Vendido', 5, '#22c55e', true, false),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Perdido', 6, '#ef4444', false, true);

-- Tokeniza pipeline
INSERT INTO public.pipelines (id, empresa, nome, descricao, is_default) VALUES
  ('a1b2c3d4-0002-4000-8000-000000000002', 'TOKENIZA', 'Novos Negócios', 'Pipeline principal da Tokeniza', true);

INSERT INTO public.pipeline_stages (pipeline_id, nome, posicao, cor, is_won, is_lost) VALUES
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Prospect', 1, '#94a3b8', false, false),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Análise de Perfil', 2, '#60a5fa', false, false),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Apresentação de Oferta', 3, '#f59e0b', false, false),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Due Diligence', 4, '#a78bfa', false, false),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Contrato Assinado', 5, '#22c55e', true, false),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Perdido', 6, '#ef4444', false, true);
