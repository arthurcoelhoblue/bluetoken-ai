
-- Fix fn_deal_ganho_to_cs_contract: cast text comparisons with empresa_tipo
CREATE OR REPLACE FUNCTION public.fn_deal_ganho_to_cs_contract()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa TEXT;
  v_cs_customer_id UUID;
  v_vencimento DATE;
BEGIN
  IF NEW.status = 'GANHO' AND OLD.status IS DISTINCT FROM 'GANHO' AND NEW.fechado_em IS NOT NULL THEN
    SELECT p.empresa::TEXT INTO v_empresa FROM pipelines p WHERE p.id = NEW.pipeline_id;
    
    SELECT id INTO v_cs_customer_id FROM cs_customers 
    WHERE contact_id = NEW.contact_id AND empresa = v_empresa::empresa_tipo;
    
    IF v_cs_customer_id IS NOT NULL THEN
      v_vencimento := (NEW.fechado_em + interval '12 months')::date;
      
      IF v_empresa = 'TOKENIZA' THEN
        INSERT INTO cs_contracts (
          customer_id, empresa, ano_fiscal, plano, valor,
          data_contratacao, data_vencimento, status, notas
        ) VALUES (
          v_cs_customer_id, v_empresa::empresa_tipo,
          EXTRACT(YEAR FROM NEW.fechado_em)::int,
          'Padrão', COALESCE(NEW.valor, 0),
          NEW.fechado_em::date, v_vencimento, 'ATIVO',
          'Criado automaticamente a partir do deal ' || NEW.titulo
        );
      ELSE
        INSERT INTO cs_contracts (
          customer_id, empresa, ano_fiscal, plano, valor,
          data_contratacao, data_vencimento, status, notas
        ) VALUES (
          v_cs_customer_id, v_empresa::empresa_tipo,
          EXTRACT(YEAR FROM NEW.fechado_em)::int,
          'Padrão', COALESCE(NEW.valor, 0),
          NEW.fechado_em::date, v_vencimento, 'ATIVO',
          'Criado automaticamente a partir do deal ' || NEW.titulo
        ) ON CONFLICT (customer_id, ano_fiscal) WHERE empresa != 'TOKENIZA'::empresa_tipo DO UPDATE SET
          valor = EXCLUDED.valor,
          data_contratacao = EXCLUDED.data_contratacao,
          data_vencimento = EXCLUDED.data_vencimento,
          notas = EXCLUDED.notas,
          updated_at = now();
      END IF;
      
      UPDATE cs_customers SET
        proxima_renovacao = (v_vencimento - interval '90 days')::date::text,
        updated_at = now()
      WHERE id = v_cs_customer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
