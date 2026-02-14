
-- =============================================
-- CS MODULE - PHASE 1: DATA MODEL
-- =============================================

-- 1. Health status enum
CREATE TYPE public.cs_health_status AS ENUM ('SAUDAVEL', 'ATENCAO', 'EM_RISCO', 'CRITICO');

-- 2. Survey type enum
CREATE TYPE public.cs_survey_tipo AS ENUM ('NPS', 'CSAT', 'CES');

-- 3. Incident type enum
CREATE TYPE public.cs_incident_tipo AS ENUM (
  'RECLAMACAO', 'ATRASO', 'ERRO_OPERACIONAL', 'FALHA_COMUNICACAO',
  'INSATISFACAO', 'SOLICITACAO', 'OUTRO'
);

-- 4. Incident severity enum
CREATE TYPE public.cs_gravidade AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- 5. Incident status enum
CREATE TYPE public.cs_incident_status AS ENUM ('ABERTA', 'EM_ANDAMENTO', 'RESOLVIDA', 'FECHADA');

-- 6. NPS category enum
CREATE TYPE public.cs_nps_categoria AS ENUM ('PROMOTOR', 'NEUTRO', 'DETRATOR');

-- =============================================
-- TABLE: cs_customers
-- =============================================
CREATE TABLE public.cs_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  empresa public.empresa_tipo NOT NULL,
  csm_id UUID REFERENCES public.profiles(id),
  health_score INTEGER DEFAULT 50,
  health_status public.cs_health_status DEFAULT 'ATENCAO',
  ultimo_nps SMALLINT,
  nps_categoria public.cs_nps_categoria,
  ultimo_csat NUMERIC(3,1),
  media_csat NUMERIC(3,1),
  ultimo_contato_em TIMESTAMPTZ,
  data_primeiro_ganho TIMESTAMPTZ,
  proxima_renovacao DATE,
  valor_mrr NUMERIC(14,2) DEFAULT 0,
  risco_churn_pct NUMERIC(5,2) DEFAULT 0,
  sentiment_score NUMERIC(5,2),
  tags TEXT[],
  notas_csm TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contact_id, empresa)
);

CREATE TRIGGER update_cs_customers_updated_at
  BEFORE UPDATE ON public.cs_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABLE: cs_surveys
-- =============================================
CREATE TABLE public.cs_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.cs_customers(id) ON DELETE CASCADE,
  empresa public.empresa_tipo NOT NULL,
  tipo public.cs_survey_tipo NOT NULL,
  canal_envio TEXT DEFAULT 'MANUAL',
  pergunta TEXT,
  nota SMALLINT,
  texto_resposta TEXT,
  sentiment_ia TEXT,
  sentiment_score NUMERIC(5,2),
  keywords_ia JSONB,
  contexto_atividade_id UUID,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABLE: cs_incidents
-- =============================================
CREATE TABLE public.cs_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.cs_customers(id) ON DELETE CASCADE,
  empresa public.empresa_tipo NOT NULL,
  tipo public.cs_incident_tipo NOT NULL DEFAULT 'OUTRO',
  gravidade public.cs_gravidade NOT NULL DEFAULT 'MEDIA',
  titulo TEXT NOT NULL,
  descricao TEXT,
  origem TEXT DEFAULT 'MANUAL',
  status public.cs_incident_status NOT NULL DEFAULT 'ABERTA',
  responsavel_id UUID REFERENCES public.profiles(id),
  resolucao TEXT,
  impacto_health INTEGER DEFAULT 0,
  detectado_por_ia BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_cs_incidents_updated_at
  BEFORE UPDATE ON public.cs_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABLE: cs_health_log
-- =============================================
CREATE TABLE public.cs_health_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.cs_customers(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  status public.cs_health_status NOT NULL,
  dimensoes JSONB NOT NULL DEFAULT '{}',
  motivo_mudanca TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABLE: cs_playbooks (structure for Phase 2)
-- =============================================
CREATE TABLE public.cs_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa public.empresa_tipo NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'MANUAL',
  trigger_config JSONB DEFAULT '{}',
  steps JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_cs_playbooks_updated_at
  BEFORE UPDATE ON public.cs_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_cs_customers_empresa ON public.cs_customers(empresa);
CREATE INDEX idx_cs_customers_contact ON public.cs_customers(contact_id);
CREATE INDEX idx_cs_customers_health ON public.cs_customers(health_status);
CREATE INDEX idx_cs_customers_csm ON public.cs_customers(csm_id);
CREATE INDEX idx_cs_surveys_customer ON public.cs_surveys(customer_id);
CREATE INDEX idx_cs_surveys_tipo ON public.cs_surveys(tipo);
CREATE INDEX idx_cs_incidents_customer ON public.cs_incidents(customer_id);
CREATE INDEX idx_cs_incidents_status ON public.cs_incidents(status);
CREATE INDEX idx_cs_incidents_gravidade ON public.cs_incidents(gravidade);
CREATE INDEX idx_cs_health_log_customer ON public.cs_health_log(customer_id);

-- =============================================
-- TRIGGER: Deal GANHO -> cs_customers
-- =============================================
CREATE OR REPLACE FUNCTION public.fn_deal_ganho_to_cs_customer()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_empresa TEXT;
  v_contact_id UUID;
BEGIN
  -- Get empresa from pipeline (deals don't have empresa column)
  SELECT p.empresa::TEXT INTO v_empresa
  FROM pipelines p WHERE p.id = NEW.pipeline_id;

  v_contact_id := NEW.contact_id;

  IF v_contact_id IS NULL OR v_empresa IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.cs_customers (
    contact_id, empresa, data_primeiro_ganho, valor_mrr, is_active
  ) VALUES (
    v_contact_id, v_empresa::empresa_tipo, now(), COALESCE(NEW.valor, 0), true
  )
  ON CONFLICT (contact_id, empresa) DO UPDATE SET
    valor_mrr = cs_customers.valor_mrr + COALESCE(NEW.valor, 0),
    is_active = true,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deal_ganho_to_cs_customer
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  WHEN (NEW.status = 'GANHO' AND OLD.status IS DISTINCT FROM 'GANHO')
  EXECUTE FUNCTION public.fn_deal_ganho_to_cs_customer();

-- Also fire on INSERT with status GANHO (e.g. imports)
CREATE TRIGGER trg_deal_insert_ganho_to_cs_customer
  AFTER INSERT ON public.deals
  FOR EACH ROW
  WHEN (NEW.status = 'GANHO')
  EXECUTE FUNCTION public.fn_deal_ganho_to_cs_customer();

-- =============================================
-- RLS POLICIES
-- =============================================

-- cs_customers
ALTER TABLE public.cs_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_customers_select" ON public.cs_customers
  FOR SELECT TO authenticated
  USING (
    empresa::text = public.get_user_empresa(auth.uid())
    OR public.get_user_empresa(auth.uid()) IS NULL
  );

CREATE POLICY "cs_customers_insert" ON public.cs_customers
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa::text = public.get_user_empresa(auth.uid())
    OR public.get_user_empresa(auth.uid()) IS NULL
  );

CREATE POLICY "cs_customers_update" ON public.cs_customers
  FOR UPDATE TO authenticated
  USING (
    empresa::text = public.get_user_empresa(auth.uid())
    OR public.get_user_empresa(auth.uid()) IS NULL
  );

CREATE POLICY "cs_customers_delete" ON public.cs_customers
  FOR DELETE TO service_role
  USING (true);

-- cs_surveys
ALTER TABLE public.cs_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_surveys_select" ON public.cs_surveys
  FOR SELECT TO authenticated
  USING (
    empresa::text = public.get_user_empresa(auth.uid())
    OR public.get_user_empresa(auth.uid()) IS NULL
  );

CREATE POLICY "cs_surveys_insert" ON public.cs_surveys
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa::text = public.get_user_empresa(auth.uid())
    OR public.get_user_empresa(auth.uid()) IS NULL
  );

CREATE POLICY "cs_surveys_update" ON public.cs_surveys
  FOR UPDATE TO authenticated
  USING (
    empresa::text = public.get_user_empresa(auth.uid())
    OR public.get_user_empresa(auth.uid()) IS NULL
  );

CREATE POLICY "cs_surveys_delete" ON public.cs_surveys
  FOR DELETE TO service_role
  USING (true);

-- cs_incidents
ALTER TABLE public.cs_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_incidents_select" ON public.cs_incidents
  FOR SELECT TO authenticated
  USING (
    empresa::text = public.get_user_empresa(auth.uid())
    OR public.get_user_empresa(auth.uid()) IS NULL
  );

CREATE POLICY "cs_incidents_insert" ON public.cs_incidents
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa::text = public.get_user_empresa(auth.uid())
    OR public.get_user_empresa(auth.uid()) IS NULL
  );

CREATE POLICY "cs_incidents_update" ON public.cs_incidents
  FOR UPDATE TO authenticated
  USING (
    empresa::text = public.get_user_empresa(auth.uid())
    OR public.get_user_empresa(auth.uid()) IS NULL
  );

CREATE POLICY "cs_incidents_delete" ON public.cs_incidents
  FOR DELETE TO service_role
  USING (true);

-- cs_health_log
ALTER TABLE public.cs_health_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_health_log_select" ON public.cs_health_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cs_customers c
      WHERE c.id = cs_health_log.customer_id
      AND (c.empresa::text = public.get_user_empresa(auth.uid())
           OR public.get_user_empresa(auth.uid()) IS NULL)
    )
  );

CREATE POLICY "cs_health_log_insert" ON public.cs_health_log
  FOR INSERT TO service_role
  WITH CHECK (true);

-- cs_playbooks
ALTER TABLE public.cs_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_playbooks_select" ON public.cs_playbooks
  FOR SELECT TO authenticated
  USING (
    empresa::text = public.get_user_empresa(auth.uid())
    OR public.get_user_empresa(auth.uid()) IS NULL
  );

CREATE POLICY "cs_playbooks_insert" ON public.cs_playbooks
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa::text = public.get_user_empresa(auth.uid())
    OR public.get_user_empresa(auth.uid()) IS NULL
  );

CREATE POLICY "cs_playbooks_update" ON public.cs_playbooks
  FOR UPDATE TO authenticated
  USING (
    empresa::text = public.get_user_empresa(auth.uid())
    OR public.get_user_empresa(auth.uid()) IS NULL
  );

CREATE POLICY "cs_playbooks_delete" ON public.cs_playbooks
  FOR DELETE TO service_role
  USING (true);

-- =============================================
-- REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.cs_customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cs_incidents;
