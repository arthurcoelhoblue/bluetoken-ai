
CREATE OR REPLACE FUNCTION public.check_cadence_stage_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_trigger RECORD;
  v_lead_id UUID;
  v_empresa TEXT;
  v_run_id UUID;
  v_unapproved_count INT;
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
    -- Validate all templates in cadence are APPROVED in Meta
    SELECT COUNT(*) INTO v_unapproved_count
    FROM cadence_steps cs
    JOIN message_templates mt ON mt.codigo = cs.template_codigo AND mt.empresa = v_empresa AND mt.ativo = true
    WHERE cs.cadence_id = v_trigger.cadence_id
      AND cs.canal = 'WHATSAPP'
      AND mt.meta_status != 'APPROVED';

    IF v_unapproved_count > 0 THEN
      -- Skip this cadence - templates not approved
      INSERT INTO deal_activities (deal_id, tipo, descricao, metadata)
      VALUES (NEW.id, 'NOTA', '⚠️ Cadência não iniciada: templates pendentes de aprovação na Meta',
        jsonb_build_object('cadence_id', v_trigger.cadence_id, 'unapproved_templates', v_unapproved_count));
      CONTINUE;
    END IF;

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
    -- Validate all templates in cadence are APPROVED in Meta
    SELECT COUNT(*) INTO v_unapproved_count
    FROM cadence_steps cs
    JOIN message_templates mt ON mt.codigo = cs.template_codigo AND mt.empresa = v_empresa AND mt.ativo = true
    WHERE cs.cadence_id = v_trigger.cadence_id
      AND cs.canal = 'WHATSAPP'
      AND mt.meta_status != 'APPROVED';

    IF v_unapproved_count > 0 THEN
      INSERT INTO deal_activities (deal_id, tipo, descricao, metadata)
      VALUES (NEW.id, 'NOTA', '⚠️ Cadência não iniciada: templates pendentes de aprovação na Meta',
        jsonb_build_object('cadence_id', v_trigger.cadence_id, 'unapproved_templates', v_unapproved_count));
      CONTINUE;
    END IF;

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
$function$;
