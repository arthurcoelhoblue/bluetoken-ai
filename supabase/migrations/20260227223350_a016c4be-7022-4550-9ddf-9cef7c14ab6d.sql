CREATE OR REPLACE FUNCTION public.update_conversation_with_intent(p_lead_id uuid, p_empresa text, p_canal text, p_intent_data jsonb, p_state_updates jsonb, p_cadence_action text DEFAULT NULL::text, p_cadence_run_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conv_id UUID;
  v_intent_id UUID;
  v_result JSONB;
  v_is_inbound BOOLEAN;
BEGIN
  -- Detect if message is inbound (to update last_inbound_at as fallback)
  v_is_inbound := COALESCE((p_state_updates->>'is_inbound')::BOOLEAN, FALSE);

  -- 1. Upsert lead_conversation_state
  INSERT INTO lead_conversation_state (
    lead_id, empresa, canal, estado_funil, framework_ativo,
    framework_data, perfil_disc, idioma_preferido,
    ultima_pergunta_id, ultimo_contato_em, last_inbound_at, updated_at
  ) VALUES (
    p_lead_id, p_empresa::empresa_tipo, p_canal::canal_tipo,
    COALESCE((p_state_updates->>'estado_funil')::estado_funil_tipo, 'SAUDACAO'::estado_funil_tipo),
    COALESCE((p_state_updates->>'framework_ativo')::framework_tipo, 'NONE'::framework_tipo),
    COALESCE(p_state_updates->'framework_data', '{}'::JSONB),
    p_state_updates->>'perfil_disc',
    COALESCE(p_state_updates->>'idioma_preferido', 'PT'),
    p_state_updates->>'ultima_pergunta_id',
    NOW(),
    CASE WHEN v_is_inbound THEN NOW() ELSE NULL END,
    NOW()
  )
  ON CONFLICT (lead_id, empresa) DO UPDATE SET
    estado_funil = COALESCE((p_state_updates->>'estado_funil')::estado_funil_tipo, lead_conversation_state.estado_funil),
    framework_ativo = COALESCE((p_state_updates->>'framework_ativo')::framework_tipo, lead_conversation_state.framework_ativo),
    framework_data = CASE 
      WHEN p_state_updates ? 'framework_data' THEN 
        COALESCE(lead_conversation_state.framework_data, '{}'::JSONB) || p_state_updates->'framework_data'
      ELSE lead_conversation_state.framework_data
    END,
    perfil_disc = COALESCE(p_state_updates->>'perfil_disc', lead_conversation_state.perfil_disc),
    idioma_preferido = COALESCE(p_state_updates->>'idioma_preferido', lead_conversation_state.idioma_preferido),
    ultima_pergunta_id = COALESCE(p_state_updates->>'ultima_pergunta_id', lead_conversation_state.ultima_pergunta_id),
    ultimo_contato_em = NOW(),
    last_inbound_at = CASE WHEN v_is_inbound THEN NOW() ELSE lead_conversation_state.last_inbound_at END,
    updated_at = NOW()
  RETURNING id INTO v_conv_id;

  -- 2. Insert lead_message_intents
  INSERT INTO lead_message_intents (
    lead_id, empresa, message_id, intent, intent_confidence,
    intent_summary, acao_recomendada, acao_aplicada, acao_detalhes,
    modelo_ia, tokens_usados, tempo_processamento_ms,
    resposta_automatica_texto, resposta_enviada_em, run_id
  ) VALUES (
    p_lead_id, p_empresa::empresa_tipo,
    (p_intent_data->>'message_id')::TEXT,
    (p_intent_data->>'intent')::lead_intent_tipo,
    (p_intent_data->>'intent_confidence')::NUMERIC,
    p_intent_data->>'intent_summary',
    COALESCE((p_intent_data->>'acao_recomendada')::sdr_acao_tipo, 'NENHUMA'::sdr_acao_tipo),
    COALESCE((p_intent_data->>'acao_aplicada')::BOOLEAN, FALSE),
    p_intent_data->'acao_detalhes',
    p_intent_data->>'modelo_ia',
    (p_intent_data->>'tokens_usados')::INT,
    (p_intent_data->>'tempo_processamento_ms')::INT,
    p_intent_data->>'resposta_automatica_texto',
    CASE WHEN p_intent_data->>'resposta_enviada_em' IS NOT NULL 
      THEN (p_intent_data->>'resposta_enviada_em')::TIMESTAMPTZ 
      ELSE NULL END,
    CASE WHEN p_intent_data->>'run_id' IS NOT NULL 
      THEN (p_intent_data->>'run_id')::UUID 
      ELSE NULL END
  ) RETURNING id INTO v_intent_id;

  -- 3. Ação na cadência (se aplicável)
  IF p_cadence_action IS NOT NULL AND p_cadence_run_id IS NOT NULL THEN
    IF p_cadence_action = 'PAUSAR' THEN
      UPDATE lead_cadence_runs 
      SET status = 'PAUSADA'::cadence_run_status, updated_at = NOW()
      WHERE id = p_cadence_run_id AND status = 'ATIVA'::cadence_run_status;
    ELSIF p_cadence_action = 'CANCELAR' THEN
      UPDATE lead_cadence_runs 
      SET status = 'CANCELADA'::cadence_run_status, updated_at = NOW()
      WHERE id = p_cadence_run_id AND status = 'ATIVA'::cadence_run_status;
    ELSIF p_cadence_action = 'RETOMAR' THEN
      UPDATE lead_cadence_runs 
      SET status = 'ATIVA'::cadence_run_status, updated_at = NOW()
      WHERE id = p_cadence_run_id AND status = 'PAUSADA'::cadence_run_status;
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'success', TRUE,
    'conversation_state_id', v_conv_id,
    'intent_id', v_intent_id,
    'cadence_action_applied', (p_cadence_action IS NOT NULL AND p_cadence_run_id IS NOT NULL)
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM,
    'error_detail', SQLSTATE
  );
END;
$function$;