
-- Atualizar trigger de auto-advance para notificar o owner do deal
CREATE OR REPLACE FUNCTION public.fn_deal_auto_advance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deal record;
  v_rule record;
  v_to_stage_nome text;
  v_from_stage_nome text;
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
    -- Get stage names for notification
    SELECT nome INTO v_from_stage_nome FROM pipeline_stages WHERE id = v_rule.from_stage_id;
    SELECT nome INTO v_to_stage_nome FROM pipeline_stages WHERE id = v_rule.to_stage_id;

    UPDATE deals SET stage_id = v_rule.to_stage_id, updated_at = now()
    WHERE id = NEW.deal_id;

    -- Mark auto_advanced in stage history
    UPDATE deal_stage_history
    SET auto_advanced = true
    WHERE deal_id = NEW.deal_id
      AND to_stage_id = v_rule.to_stage_id
      AND created_at >= now() - interval '5 seconds';

    -- Notify deal owner
    IF v_deal.owner_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, empresa, titulo, mensagem, tipo, referencia_tipo, referencia_id, link)
      VALUES (
        v_deal.owner_id,
        (SELECT empresa FROM pipelines WHERE id = v_deal.pip_id),
        '⚡ Deal auto-movido: ' || v_deal.titulo,
        'Movido de "' || COALESCE(v_from_stage_nome, '?') || '" para "' || COALESCE(v_to_stage_nome, '?') || '" por regra automática.',
        'INFO',
        'DEAL',
        NEW.deal_id,
        '/pipeline'
      );
    END IF;

    -- Create deal activity for audit trail
    INSERT INTO deal_activities (deal_id, tipo, descricao, metadata)
    VALUES (
      NEW.deal_id,
      'NOTA',
      '⚡ Auto-movido de "' || COALESCE(v_from_stage_nome, '?') || '" para "' || COALESCE(v_to_stage_nome, '?') || '"',
      jsonb_build_object('source', 'auto_rule', 'rule_id', v_rule.id, 'from_stage', v_from_stage_nome, 'to_stage', v_to_stage_nome)
    );
  END IF;

  RETURN NEW;
END;
$$;
