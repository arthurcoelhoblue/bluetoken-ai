CREATE OR REPLACE FUNCTION public.fn_deal_ganho_to_cs_customer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa TEXT;
  v_contact_id UUID;
BEGIN
  SELECT p.empresa::TEXT INTO v_empresa
  FROM pipelines p WHERE p.id = NEW.pipeline_id;

  v_contact_id := NEW.contact_id;

  IF v_contact_id IS NULL OR v_empresa IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.cs_customers (
    contact_id, empresa, data_primeiro_ganho, valor_mrr, is_active
  ) VALUES (
    v_contact_id, v_empresa::empresa_tipo, COALESCE(NEW.fechado_em, now()), COALESCE(NEW.valor, 0), true
  )
  ON CONFLICT (contact_id, empresa) DO UPDATE SET
    valor_mrr = cs_customers.valor_mrr + COALESCE(NEW.valor, 0),
    is_active = true,
    updated_at = now();

  RETURN NEW;
END;
$function$;