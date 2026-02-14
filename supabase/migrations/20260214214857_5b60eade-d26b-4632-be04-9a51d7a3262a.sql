
-- ============================================================
-- BLOCO 1 — Migration Unificada Patches 5-9
-- ============================================================

-- 1. Novas colunas em deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS scoring_dimensoes jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proxima_acao_sugerida text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scoring_updated_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS origem text DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS contexto_sdr jsonb DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_deals_scoring_updated
  ON public.deals(scoring_updated_at DESC NULLS LAST)
  WHERE status = 'ABERTO';

-- 2. Novas colunas em calls
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS transcription text,
  ADD COLUMN IF NOT EXISTS summary_ia text,
  ADD COLUMN IF NOT EXISTS sentiment text,
  ADD COLUMN IF NOT EXISTS action_items jsonb,
  ADD COLUMN IF NOT EXISTS cs_customer_id uuid REFERENCES public.cs_customers(id);

-- 3. Novas colunas em deal_stage_history
ALTER TABLE public.deal_stage_history
  ADD COLUMN IF NOT EXISTS changed_by uuid,
  ADD COLUMN IF NOT EXISTS auto_advanced boolean DEFAULT false;

-- ============================================================
-- 4. Tabela pipeline_auto_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pipeline_auto_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  empresa public.empresa_tipo NOT NULL,
  from_stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id),
  to_stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id),
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.pipeline_auto_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view auto rules for their empresa"
  ON public.pipeline_auto_rules FOR SELECT
  USING (empresa::text = public.get_user_empresa(auth.uid()));

CREATE POLICY "Admins can manage auto rules"
  ON public.pipeline_auto_rules FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- ============================================================
-- 5. Tabela cs_playbook_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cs_playbook_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id uuid NOT NULL REFERENCES public.cs_playbooks(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.cs_customers(id) ON DELETE CASCADE,
  empresa public.empresa_tipo NOT NULL,
  status text NOT NULL DEFAULT 'ATIVA',
  current_step integer NOT NULL DEFAULT 0,
  step_results jsonb DEFAULT '[]'::jsonb,
  started_at timestamptz DEFAULT now(),
  next_step_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playbook_runs_next
  ON public.cs_playbook_runs(next_step_at)
  WHERE status = 'ATIVA';

CREATE INDEX IF NOT EXISTS idx_playbook_runs_customer
  ON public.cs_playbook_runs(customer_id, playbook_id);

ALTER TABLE public.cs_playbook_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view playbook runs for their empresa"
  ON public.cs_playbook_runs FOR SELECT
  USING (empresa::text = public.get_user_empresa(auth.uid()));

CREATE POLICY "Service role manages playbook runs"
  ON public.cs_playbook_runs FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- ============================================================
-- 6. Tabela revenue_forecast_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.revenue_forecast_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa public.empresa_tipo NOT NULL,
  forecast_date date NOT NULL DEFAULT CURRENT_DATE,
  horizonte_dias integer NOT NULL,
  pessimista numeric(14,2) NOT NULL DEFAULT 0,
  realista numeric(14,2) NOT NULL DEFAULT 0,
  otimista numeric(14,2) NOT NULL DEFAULT 0,
  detalhes jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forecast_log_date
  ON public.revenue_forecast_log(empresa, forecast_date DESC);

ALTER TABLE public.revenue_forecast_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view forecasts for their empresa"
  ON public.revenue_forecast_log FOR SELECT
  USING (empresa::text = public.get_user_empresa(auth.uid()));

CREATE POLICY "Service role inserts forecasts"
  ON public.revenue_forecast_log FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 7. Trigger: auto-advance deal on activity
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_deal_auto_advance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deal record;
  v_rule record;
BEGIN
  SELECT d.*, ps.pipeline_id AS pip_id
  INTO v_deal
  FROM deals d
  JOIN pipeline_stages ps ON ps.id = d.stage_id
  WHERE d.id = NEW.deal_id;

  IF v_deal IS NULL OR v_deal.status != 'ABERTO' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_rule
  FROM pipeline_auto_rules
  WHERE pipeline_id = v_deal.pip_id
    AND from_stage_id = v_deal.stage_id
    AND trigger_type = 'ACTIVITY_TYPE'
    AND trigger_config->>'activity_type' = NEW.tipo
    AND is_active = true
  LIMIT 1;

  IF v_rule IS NOT NULL THEN
    UPDATE deals SET stage_id = v_rule.to_stage_id, updated_at = now()
    WHERE id = NEW.deal_id;

    -- Mark auto_advanced in stage history
    UPDATE deal_stage_history
    SET auto_advanced = true
    WHERE deal_id = NEW.deal_id
      AND to_stage_id = v_rule.to_stage_id
      AND created_at >= now() - interval '5 seconds';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_auto_advance ON public.deal_activities;
CREATE TRIGGER trg_deal_auto_advance
  AFTER INSERT ON public.deal_activities
  FOR EACH ROW EXECUTE FUNCTION public.fn_deal_auto_advance();

-- ============================================================
-- 8. Trigger: auto-create deal_activity on call with deal_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_call_to_deal_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.deal_id IS NOT NULL AND NEW.status IN ('ANSWERED', 'MISSED') THEN
    INSERT INTO deal_activities (deal_id, tipo, descricao, user_id, metadata)
    VALUES (
      NEW.deal_id,
      'CALL',
      CASE NEW.direcao
        WHEN 'INBOUND' THEN 'Chamada recebida (' || COALESCE(NEW.duracao_segundos, 0) || 's)'
        ELSE 'Chamada realizada (' || COALESCE(NEW.duracao_segundos, 0) || 's)'
      END,
      NEW.user_id,
      jsonb_build_object(
        'call_id', NEW.id,
        'direction', NEW.direcao,
        'duration', NEW.duracao_segundos,
        'recording_url', NEW.recording_url
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_call_to_deal_activity ON public.calls;
CREATE TRIGGER trg_call_to_deal_activity
  AFTER INSERT ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.fn_call_to_deal_activity();

-- ============================================================
-- 9. Update updated_at triggers for new tables
-- ============================================================
CREATE TRIGGER update_pipeline_auto_rules_updated_at
  BEFORE UPDATE ON public.pipeline_auto_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cs_playbook_runs_updated_at
  BEFORE UPDATE ON public.cs_playbook_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
