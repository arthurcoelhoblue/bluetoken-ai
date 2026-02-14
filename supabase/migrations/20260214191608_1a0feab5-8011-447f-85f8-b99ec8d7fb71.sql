
-- =============================================
-- FASE 3: Gamificação CS + CSAT automático
-- =============================================

-- 1. Inserir badges CS na tabela seller_badges
INSERT INTO public.seller_badges (key, nome, descricao, icone, categoria, criterio_valor)
VALUES
  ('cs_rescue_1', 'Resgate CS', 'Resgatou 1 cliente de risco', '🆘', 'CS', 1),
  ('cs_rescue_5', 'Herói da Retenção', 'Resgatou 5 clientes de risco', '🦸', 'CS', 5),
  ('cs_incident_resolver', 'Resolvedor', 'Resolveu 10 incidências', '🔧', 'CS', 10),
  ('cs_nps_champion', 'Campeão NPS', 'NPS médio >= 8 por 3 meses', '🏆', 'CS', 8),
  ('cs_retention_master', 'Mestre da Retenção', '100% de renovações no trimestre', '🔒', 'CS', 100)
ON CONFLICT (key) DO NOTHING;

-- 2. Trigger: pontuar CSM quando health melhora (EM_RISCO/CRITICO -> ATENCAO/SAUDAVEL)
CREATE OR REPLACE FUNCTION public.fn_cs_gamify_health_improve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_csm_id UUID;
  v_empresa TEXT;
  v_rescue_count INT;
BEGIN
  -- Only fire when status improves from risky to safe
  IF NEW.status IN ('SAUDAVEL', 'ATENCAO') AND OLD.status IN ('EM_RISCO', 'CRITICO') THEN
    SELECT csm_id, empresa::text INTO v_csm_id, v_empresa
    FROM cs_customers WHERE id = NEW.customer_id;

    IF v_csm_id IS NOT NULL THEN
      -- Award points
      INSERT INTO seller_points_log (user_id, empresa, pontos, tipo, referencia_id)
      VALUES (v_csm_id, v_empresa, 20, 'CS_RESGATE', NEW.customer_id::text);

      -- Count total rescues for badge
      SELECT COUNT(DISTINCT hl2.customer_id) INTO v_rescue_count
      FROM cs_health_log hl1
      JOIN cs_health_log hl2 ON hl2.customer_id = hl1.customer_id AND hl2.created_at > hl1.created_at
      JOIN cs_customers cc ON cc.id = hl2.customer_id AND cc.csm_id = v_csm_id
      WHERE hl1.status IN ('EM_RISCO', 'CRITICO') AND hl2.status IN ('SAUDAVEL', 'ATENCAO');

      IF v_rescue_count >= 1 THEN
        INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
        VALUES (v_csm_id, 'cs_rescue_1', v_empresa, 'auto') ON CONFLICT DO NOTHING;
      END IF;
      IF v_rescue_count >= 5 THEN
        INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
        VALUES (v_csm_id, 'cs_rescue_5', v_empresa, 'auto') ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cs_gamify_health ON cs_health_log;
CREATE TRIGGER trg_cs_gamify_health
  AFTER INSERT ON cs_health_log
  FOR EACH ROW
  WHEN (NEW.status IN ('SAUDAVEL', 'ATENCAO'))
  EXECUTE FUNCTION fn_cs_gamify_health_improve();

-- Note: The trigger compares NEW with the previous log entry, not OLD (since it's INSERT)
-- We need to adjust: on INSERT, compare with the customer's current status before this log
CREATE OR REPLACE FUNCTION public.fn_cs_gamify_health_improve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_csm_id UUID;
  v_empresa TEXT;
  v_prev_status TEXT;
  v_rescue_count INT;
BEGIN
  -- Get previous health log entry for this customer
  SELECT status::text INTO v_prev_status
  FROM cs_health_log
  WHERE customer_id = NEW.customer_id AND id != NEW.id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Only fire when improving from risky
  IF NEW.status IN ('SAUDAVEL', 'ATENCAO') AND v_prev_status IN ('EM_RISCO', 'CRITICO') THEN
    SELECT csm_id, empresa::text INTO v_csm_id, v_empresa
    FROM cs_customers WHERE id = NEW.customer_id;

    IF v_csm_id IS NOT NULL THEN
      INSERT INTO seller_points_log (user_id, empresa, pontos, tipo, referencia_id)
      VALUES (v_csm_id, v_empresa, 20, 'CS_RESGATE', NEW.customer_id::text);

      SELECT COUNT(DISTINCT customer_id) INTO v_rescue_count
      FROM seller_points_log
      WHERE user_id = v_csm_id AND tipo = 'CS_RESGATE';

      IF v_rescue_count >= 1 THEN
        INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
        VALUES (v_csm_id, 'cs_rescue_1', v_empresa, 'auto') ON CONFLICT DO NOTHING;
      END IF;
      IF v_rescue_count >= 5 THEN
        INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
        VALUES (v_csm_id, 'cs_rescue_5', v_empresa, 'auto') ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Trigger: pontuar CSM quando resolve incidência
CREATE OR REPLACE FUNCTION public.fn_cs_gamify_incident_resolved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_resolved_count INT;
BEGIN
  IF NEW.status = 'RESOLVIDA' AND OLD.status != 'RESOLVIDA' AND NEW.responsavel_id IS NOT NULL THEN
    -- Award points
    INSERT INTO seller_points_log (user_id, empresa, pontos, tipo, referencia_id)
    VALUES (NEW.responsavel_id, NEW.empresa::text, 10, 'CS_INCIDENCIA_RESOLVIDA', NEW.id::text);

    -- Check badge
    SELECT COUNT(*) INTO v_resolved_count
    FROM cs_incidents
    WHERE responsavel_id = NEW.responsavel_id AND status = 'RESOLVIDA';

    IF v_resolved_count >= 10 THEN
      INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
      VALUES (NEW.responsavel_id, 'cs_incident_resolver', NEW.empresa::text, 'auto') ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cs_gamify_incident ON cs_incidents;
CREATE TRIGGER trg_cs_gamify_incident
  AFTER UPDATE ON cs_incidents
  FOR EACH ROW
  EXECUTE FUNCTION fn_cs_gamify_incident_resolved();

-- 4. Trigger: CSAT automático após resolução de incidência
CREATE OR REPLACE FUNCTION public.fn_cs_auto_csat_on_resolve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'RESOLVIDA' AND OLD.status != 'RESOLVIDA' THEN
    -- Call cs-nps-auto with tipo=CSAT
    PERFORM extensions.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/cs-nps-auto',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'tipo', 'CSAT',
        'customer_id', NEW.customer_id::text,
        'incident_id', NEW.id::text
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Auto CSAT trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cs_auto_csat ON cs_incidents;
CREATE TRIGGER trg_cs_auto_csat
  AFTER UPDATE ON cs_incidents
  FOR EACH ROW
  EXECUTE FUNCTION fn_cs_auto_csat_on_resolve();
