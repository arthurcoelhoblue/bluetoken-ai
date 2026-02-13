
-- =============================================
-- Patch 9: Cadências CRM
-- =============================================

-- 1. Bridge table: deal_cadence_runs
CREATE TABLE public.deal_cadence_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  cadence_run_id UUID NOT NULL REFERENCES public.lead_cadence_runs(id) ON DELETE CASCADE,
  trigger_stage_id UUID REFERENCES public.pipeline_stages(id),
  trigger_type TEXT NOT NULL DEFAULT 'MANUAL' CHECK (trigger_type IN ('MANUAL', 'STAGE_ENTER', 'STAGE_EXIT', 'SLA_BREACH')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deal_id, cadence_run_id)
);

ALTER TABLE public.deal_cadence_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view deal_cadence_runs"
  ON public.deal_cadence_runs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/Closer can manage deal_cadence_runs"
  ON public.deal_cadence_runs FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'CLOSER'));

CREATE TRIGGER update_deal_cadence_runs_updated_at
  BEFORE UPDATE ON public.deal_cadence_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Config table: cadence_stage_triggers
CREATE TABLE public.cadence_stage_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  cadence_id UUID NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL DEFAULT 'STAGE_ENTER' CHECK (trigger_type IN ('STAGE_ENTER', 'STAGE_EXIT')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id, stage_id, cadence_id, trigger_type)
);

ALTER TABLE public.cadence_stage_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cadence_stage_triggers"
  ON public.cadence_stage_triggers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage cadence_stage_triggers"
  ON public.cadence_stage_triggers FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE TRIGGER update_cadence_stage_triggers_updated_at
  BEFORE UPDATE ON public.cadence_stage_triggers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. View: cadencias_crm
CREATE OR REPLACE VIEW public.cadencias_crm WITH (security_invoker = true) AS
SELECT
  c.id,
  c.codigo,
  c.nome,
  c.descricao,
  c.empresa,
  c.ativo,
  c.canal_principal,
  (SELECT COUNT(*) FROM public.cadence_steps cs WHERE cs.cadence_id = c.id) AS total_steps,
  (SELECT COUNT(*) FROM public.deal_cadence_runs dcr WHERE dcr.cadence_run_id IN (
    SELECT lcr.id FROM public.lead_cadence_runs lcr WHERE lcr.cadence_id = c.id
  ) AND dcr.status = 'ACTIVE') AS deals_ativos,
  (SELECT COUNT(*) FROM public.deal_cadence_runs dcr WHERE dcr.cadence_run_id IN (
    SELECT lcr.id FROM public.lead_cadence_runs lcr WHERE lcr.cadence_id = c.id
  ) AND dcr.status = 'COMPLETED') AS deals_completados,
  (SELECT COUNT(*) FROM public.deal_cadence_runs dcr WHERE dcr.cadence_run_id IN (
    SELECT lcr.id FROM public.lead_cadence_runs lcr WHERE lcr.cadence_id = c.id
  )) AS deals_total,
  (SELECT jsonb_agg(jsonb_build_object(
    'id', cst.id,
    'stage_id', cst.stage_id,
    'trigger_type', cst.trigger_type,
    'is_active', cst.is_active
  )) FROM public.cadence_stage_triggers cst WHERE cst.cadence_id = c.id) AS triggers
FROM public.cadences c;

-- 4. View: deal_cadencia_status
CREATE OR REPLACE VIEW public.deal_cadencia_status WITH (security_invoker = true) AS
SELECT
  dcr.id AS deal_cadence_run_id,
  dcr.deal_id,
  dcr.status AS bridge_status,
  dcr.trigger_type,
  dcr.trigger_stage_id,
  dcr.created_at AS started_at,
  lcr.id AS cadence_run_id,
  lcr.cadence_id,
  lcr.status AS run_status,
  lcr.last_step_ordem,
  lcr.next_step_ordem,
  lcr.next_run_at,
  c.nome AS cadence_nome,
  c.codigo AS cadence_codigo,
  (SELECT COUNT(*) FROM public.cadence_steps cs WHERE cs.cadence_id = c.id) AS total_steps,
  ps.nome AS trigger_stage_nome
FROM public.deal_cadence_runs dcr
JOIN public.lead_cadence_runs lcr ON lcr.id = dcr.cadence_run_id
JOIN public.cadences c ON c.id = lcr.cadence_id
LEFT JOIN public.pipeline_stages ps ON ps.id = dcr.trigger_stage_id;

-- 5. Trigger function: auto-start cadence on stage change
CREATE OR REPLACE FUNCTION public.check_cadence_stage_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trigger RECORD;
  v_lead_id UUID;
  v_empresa TEXT;
  v_run_id UUID;
BEGIN
  -- Only fire on stage change
  IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
    RETURN NEW;
  END IF;

  -- Get empresa from pipeline
  SELECT p.empresa::TEXT INTO v_empresa
  FROM pipelines p WHERE p.id = NEW.pipeline_id;

  -- Get legacy_lead_id from contact
  SELECT ct.legacy_lead_id INTO v_lead_id
  FROM contacts ct WHERE ct.id = NEW.contact_id;

  -- No lead_id means we can't start a cadence
  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check STAGE_ENTER triggers for new stage
  FOR v_trigger IN
    SELECT cst.cadence_id
    FROM cadence_stage_triggers cst
    WHERE cst.stage_id = NEW.stage_id
      AND cst.pipeline_id = NEW.pipeline_id
      AND cst.trigger_type = 'STAGE_ENTER'
      AND cst.is_active = true
  LOOP
    -- Check if there's already an active run for this cadence+deal
    IF NOT EXISTS (
      SELECT 1 FROM deal_cadence_runs dcr
      JOIN lead_cadence_runs lcr ON lcr.id = dcr.cadence_run_id
      WHERE dcr.deal_id = NEW.id
        AND lcr.cadence_id = v_trigger.cadence_id
        AND dcr.status = 'ACTIVE'
    ) THEN
      -- Create lead_cadence_run (PT status)
      INSERT INTO lead_cadence_runs (
        cadence_id, lead_id, empresa, status, last_step_ordem, next_step_ordem, next_run_at
      ) VALUES (
        v_trigger.cadence_id, v_lead_id, v_empresa::empresa_tipo, 'ATIVA', 0, 1, now()
      ) RETURNING id INTO v_run_id;

      -- Create bridge
      INSERT INTO deal_cadence_runs (deal_id, cadence_run_id, trigger_stage_id, trigger_type, status)
      VALUES (NEW.id, v_run_id, NEW.stage_id, 'STAGE_ENTER', 'ACTIVE');

      -- Log activity
      INSERT INTO deal_activities (deal_id, tipo, descricao, user_id)
      VALUES (NEW.id, 'CADENCIA', 'Cadência iniciada automaticamente',
        COALESCE(auth.uid(), NEW.owner_id));
    END IF;
  END LOOP;

  -- Check STAGE_EXIT triggers for old stage
  FOR v_trigger IN
    SELECT cst.cadence_id
    FROM cadence_stage_triggers cst
    WHERE cst.stage_id = OLD.stage_id
      AND cst.pipeline_id = NEW.pipeline_id
      AND cst.trigger_type = 'STAGE_EXIT'
      AND cst.is_active = true
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM deal_cadence_runs dcr
      JOIN lead_cadence_runs lcr ON lcr.id = dcr.cadence_run_id
      WHERE dcr.deal_id = NEW.id
        AND lcr.cadence_id = v_trigger.cadence_id
        AND dcr.status = 'ACTIVE'
    ) THEN
      INSERT INTO lead_cadence_runs (
        cadence_id, lead_id, empresa, status, last_step_ordem, next_step_ordem, next_run_at
      ) VALUES (
        v_trigger.cadence_id, v_lead_id, v_empresa::empresa_tipo, 'ATIVA', 0, 1, now()
      ) RETURNING id INTO v_run_id;

      INSERT INTO deal_cadence_runs (deal_id, cadence_run_id, trigger_stage_id, trigger_type, status)
      VALUES (NEW.id, v_run_id, OLD.stage_id, 'STAGE_EXIT', 'ACTIVE');

      INSERT INTO deal_activities (deal_id, tipo, descricao, user_id)
      VALUES (NEW.id, 'CADENCIA', 'Cadência iniciada automaticamente (saída de estágio)',
        COALESCE(auth.uid(), NEW.owner_id));
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 6. Attach trigger to deals
CREATE TRIGGER trg_check_cadence_stage
  AFTER UPDATE OF stage_id ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.check_cadence_stage_trigger();
