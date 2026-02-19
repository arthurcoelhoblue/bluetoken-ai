
CREATE OR REPLACE FUNCTION public.fn_blue_deal_ganho_to_implantacao()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa TEXT;
  v_implantacao_pipeline_id UUID := '26de333a-7f8e-4d65-847e-5ee44da836b6';
  v_aberto_stage_id UUID := '1d4f3b2b-882a-4db0-8209-e93146ff6abb';
  v_existing UUID;
BEGIN
  -- Só dispara quando status muda para GANHO
  IF NEW.status != 'GANHO' OR OLD.status IS NOT DISTINCT FROM 'GANHO' THEN
    RETURN NEW;
  END IF;

  -- Verificar se é deal da BLUE
  SELECT p.empresa::TEXT INTO v_empresa
  FROM pipelines p WHERE p.id = NEW.pipeline_id;

  IF v_empresa != 'BLUE' THEN
    RETURN NEW;
  END IF;

  -- Não criar se o deal já é do pipeline Implantação
  IF NEW.pipeline_id = v_implantacao_pipeline_id THEN
    RETURN NEW;
  END IF;

  -- Verificar se já existe deal aberto no Implantação para o mesmo contato
  SELECT id INTO v_existing
  FROM deals
  WHERE contact_id = NEW.contact_id
    AND pipeline_id = v_implantacao_pipeline_id
    AND status = 'ABERTO'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Criar deal no pipeline Implantação
  INSERT INTO deals (
    contact_id,
    pipeline_id,
    stage_id,
    titulo,
    valor,
    owner_id,
    status,
    temperatura
  ) VALUES (
    NEW.contact_id,
    v_implantacao_pipeline_id,
    v_aberto_stage_id,
    'Implantação - ' || NEW.titulo,
    NEW.valor,
    NEW.owner_id,
    'ABERTO',
    'QUENTE'
  );

  -- Registrar atividade no deal original
  INSERT INTO deal_activities (deal_id, tipo, descricao, metadata)
  VALUES (
    NEW.id,
    'NOTA',
    '🚀 Deal migrado automaticamente para o funil Implantação',
    jsonb_build_object('target_pipeline', 'Implantação', 'target_stage', 'Aberto (comercial)')
  );

  RETURN NEW;
END;
$function$;

-- Criar trigger no deals (após as triggers existentes)
DROP TRIGGER IF EXISTS trg_blue_deal_ganho_to_implantacao ON deals;
CREATE TRIGGER trg_blue_deal_ganho_to_implantacao
  AFTER UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION fn_blue_deal_ganho_to_implantacao();
