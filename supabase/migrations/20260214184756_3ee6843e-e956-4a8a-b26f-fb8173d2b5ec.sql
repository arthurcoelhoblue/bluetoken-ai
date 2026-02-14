
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Trigger: recalculate health when cs_surveys gets a response
CREATE OR REPLACE FUNCTION public.fn_cs_survey_recalc_health()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  v_customer_id := NEW.customer_id;
  
  -- Update cs_customers NPS/CSAT fields
  IF NEW.tipo = 'NPS' AND NEW.nota IS NOT NULL THEN
    UPDATE cs_customers SET
      ultimo_nps = NEW.nota,
      nps_categoria = CASE
        WHEN NEW.nota >= 9 THEN 'PROMOTOR'::cs_nps_categoria
        WHEN NEW.nota >= 7 THEN 'NEUTRO'::cs_nps_categoria
        ELSE 'DETRATOR'::cs_nps_categoria
      END,
      updated_at = now()
    WHERE id = v_customer_id;
  END IF;
  
  IF NEW.tipo = 'CSAT' AND NEW.nota IS NOT NULL THEN
    UPDATE cs_customers SET
      ultimo_csat = NEW.nota,
      media_csat = (
        SELECT AVG(nota) FROM (
          SELECT nota FROM cs_surveys
          WHERE customer_id = v_customer_id AND tipo = 'CSAT' AND nota IS NOT NULL
          ORDER BY respondido_em DESC LIMIT 3
        ) sub
      ),
      updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  -- Trigger health recalculation via pg_net
  PERFORM extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/cs-health-calculator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('customer_id', v_customer_id::text)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block survey insert if health recalc fails
  RAISE WARNING 'Health recalc trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cs_survey_health_recalc
AFTER INSERT OR UPDATE OF nota ON public.cs_surveys
FOR EACH ROW
WHEN (NEW.nota IS NOT NULL)
EXECUTE FUNCTION public.fn_cs_survey_recalc_health();

-- Trigger: recalculate health when incident is created
CREATE OR REPLACE FUNCTION public.fn_cs_incident_recalc_health()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/cs-health-calculator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('customer_id', NEW.customer_id::text)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Health recalc trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cs_incident_health_recalc
AFTER INSERT ON public.cs_incidents
FOR EACH ROW
EXECUTE FUNCTION public.fn_cs_incident_recalc_health();
