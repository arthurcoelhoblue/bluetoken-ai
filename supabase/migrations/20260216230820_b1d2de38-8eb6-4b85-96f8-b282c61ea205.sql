
-- Fase 3: Corrigir 3 triggers com risco de cross-tenant leak

-- 1. fn_gamify_deal_ganho — filtrar contagem de deals por empresa via pipelines
CREATE OR REPLACE FUNCTION public.fn_gamify_deal_ganho()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa text;
  v_pontos int;
  v_total_ganhos int;
BEGIN
  IF NEW.status = 'GANHO' AND (OLD.status IS DISTINCT FROM 'GANHO') AND NEW.owner_id IS NOT NULL THEN
    SELECT c.empresa::text INTO v_empresa FROM contacts c WHERE c.id = NEW.contact_id;
    IF v_empresa IS NULL THEN v_empresa := 'BLUE'; END IF;
    v_pontos := GREATEST(10, COALESCE(NEW.valor, 0) / 1000);
    INSERT INTO seller_points_log (user_id, empresa, pontos, tipo, referencia_id)
    VALUES (NEW.owner_id, v_empresa, v_pontos, 'DEAL_GANHO', NEW.id);

    -- CORRECAO: filtrar por empresa via pipelines (antes contava deals de TODOS os tenants)
    SELECT COUNT(*) INTO v_total_ganhos
    FROM deals d
    JOIN pipelines p ON p.id = d.pipeline_id
    WHERE d.owner_id = NEW.owner_id
      AND d.status = 'GANHO'
      AND p.empresa::text = v_empresa;

    IF v_total_ganhos >= 1 THEN
      INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
      VALUES (NEW.owner_id, 'first_deal', v_empresa, 'auto') ON CONFLICT DO NOTHING;
    END IF;
    IF v_total_ganhos >= 10 THEN
      INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
      VALUES (NEW.owner_id, 'deal_10', v_empresa, 'auto') ON CONFLICT DO NOTHING;
    END IF;
    IF v_total_ganhos >= 50 THEN
      INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
      VALUES (NEW.owner_id, 'deal_50', v_empresa, 'auto') ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. fn_gamify_activity_done — filtrar contagem de atividades por empresa via deals/pipelines
CREATE OR REPLACE FUNCTION public.fn_gamify_activity_done()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa text;
  v_week_count int;
BEGIN
  IF NEW.tarefa_concluida = true AND (OLD.tarefa_concluida IS DISTINCT FROM true) AND NEW.user_id IS NOT NULL THEN
    SELECT c.empresa::text INTO v_empresa
    FROM deals d JOIN contacts c ON c.id = d.contact_id
    WHERE d.id = NEW.deal_id;
    IF v_empresa IS NULL THEN v_empresa := 'BLUE'; END IF;

    INSERT INTO seller_points_log (user_id, empresa, pontos, tipo, referencia_id)
    VALUES (NEW.user_id, v_empresa, 5, 'TAREFA_CONCLUIDA', NEW.id::text);

    -- CORRECAO: filtrar por empresa via deals/pipelines (antes contava atividades de TODOS os tenants)
    SELECT COUNT(*) INTO v_week_count
    FROM deal_activities da
    JOIN deals d ON d.id = da.deal_id
    JOIN pipelines p ON p.id = d.pipeline_id
    WHERE da.user_id = NEW.user_id
      AND da.tarefa_concluida = true
      AND da.created_at >= date_trunc('week', now())
      AND p.empresa::text = v_empresa;

    IF v_week_count >= 50 THEN
      INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
      VALUES (NEW.user_id, 'activity_50', v_empresa, to_char(now(), 'IYYY-IW'))
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. fn_cs_gamify_incident_resolved — filtrar contagem de incidentes por empresa
CREATE OR REPLACE FUNCTION public.fn_cs_gamify_incident_resolved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resolved_count INT;
BEGIN
  IF NEW.status = 'RESOLVIDA' AND OLD.status != 'RESOLVIDA' AND NEW.responsavel_id IS NOT NULL THEN
    -- Award points
    INSERT INTO seller_points_log (user_id, empresa, pontos, tipo, referencia_id)
    VALUES (NEW.responsavel_id, NEW.empresa::text, 10, 'CS_INCIDENCIA_RESOLVIDA', NEW.id::text);

    -- CORRECAO: filtrar por empresa (antes contava incidentes de TODOS os tenants)
    SELECT COUNT(*) INTO v_resolved_count
    FROM cs_incidents
    WHERE responsavel_id = NEW.responsavel_id
      AND status = 'RESOLVIDA'
      AND empresa = NEW.empresa;

    IF v_resolved_count >= 10 THEN
      INSERT INTO seller_badge_awards (user_id, badge_key, empresa, referencia)
      VALUES (NEW.responsavel_id, 'cs_incident_resolver', NEW.empresa::text, 'auto') ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
