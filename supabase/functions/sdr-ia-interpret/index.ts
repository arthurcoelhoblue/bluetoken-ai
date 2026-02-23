import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// SDR-IA INTERPRET — ORCHESTRATOR (Consolidated)
// Now imports modules directly instead of HTTP fetch()
// ========================================

import { getWebhookCorsHeaders } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

// Local modules (previously separate Edge Functions)
import { loadFullContext, type ParsedContext } from "./message-parser.ts";
import { classifyIntent, type ClassifierResult } from "./intent-classifier.ts";
import { sanitizeResponse } from "./response-generator.ts";
import { executeActions } from "./action-executor.ts";

const corsHeaders = getWebhookCorsHeaders();
const log = createLogger('sdr-ia-interpret');

// Valid enum values for sdr_acao_tipo
const VALID_ACOES = new Set([
  'NENHUMA', 'ENVIAR_RESPOSTA_AUTOMATICA', 'CRIAR_TAREFA_CLOSER',
  'ESCALAR_HUMANO', 'PAUSAR_CADENCIA', 'CANCELAR_CADENCIA',
  'RETOMAR_CADENCIA', 'AJUSTAR_TEMPERATURA', 'MARCAR_OPT_OUT', 'HANDOFF_EMPRESA',
]);

const ACAO_MAP: Record<string, string> = {
  ESCLARECIMENTO_INICIAL: 'ENVIAR_RESPOSTA_AUTOMATICA',
  APRESENTAR_CLARIFICAR: 'ENVIAR_RESPOSTA_AUTOMATICA',
  ESCLARECER_SITUACAO: 'ENVIAR_RESPOSTA_AUTOMATICA',
  APRESENTAR_ESCLARECER: 'ENVIAR_RESPOSTA_AUTOMATICA',
  RESPONDER_QUALIFICAR: 'ENVIAR_RESPOSTA_AUTOMATICA',
  DESQUALIFICAR_LEAD: 'MARCAR_OPT_OUT',
  AGUARDAR_ESCOLHA_DEPARTAMENTO: 'ESCALAR_HUMANO',
  RESPONDER_DEPARTAMENTO_COMERCIAL: 'ESCALAR_HUMANO',
  QUEBRAR_LOOP_AUTOMATICO: 'PAUSAR_CADENCIA',
};

function normalizarAcao(acao: string | undefined): string {
  if (!acao) return 'NENHUMA';
  if (VALID_ACOES.has(acao)) return acao;
  const mapped = ACAO_MAP[acao];
  if (mapped) {
    log.info('Ação normalizada', { original: acao, normalizada: mapped });
    return mapped;
  }
  log.warn('Ação desconhecida normalizada para NENHUMA', { original: acao });
  return 'NENHUMA';
}

interface InterpretRequest {
  messageId: string;
  source?: 'BLUECHAT' | 'WHATSAPP' | string;
  mode?: 'PASSIVE_CHAT' | string;
  triageSummary?: { clienteNome: string | null; email: string | null; resumoTriagem: string | null; historico: string | null };
  testMode?: string;
  mensagens?: string[];
}

interface MessageRow {
  id: string;
  lead_id: string;
  run_id: string | null;
  empresa: string;
  conteudo: string;
  direcao: string;
  created_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json() as InterpretRequest;

    // Test mode (urgency detection — kept for backward compat)
    if (body.testMode === 'urgencia') {
      const supabase = createServiceClient();
      const result = await classifyIntent(supabase, { mensagem_normalizada: 'test', empresa: 'BLUE' });
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { messageId, source, mode, triageSummary } = body;
    if (!messageId) return new Response(JSON.stringify({ error: 'messageId obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createServiceClient();

    // ========================================
    // 1. LOAD MESSAGE
    // ========================================
    const { data: message, error: msgError } = await supabase
      .from('lead_messages')
      .select('id, lead_id, run_id, empresa, conteudo, direcao, created_at')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return new Response(JSON.stringify({ success: false, error: 'Mensagem não encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const msg = message as MessageRow;

    // ========================================
    // 2. QUICK CHECKS: duplicate
    // ========================================
    const { data: existingIntent } = await supabase.from('lead_message_intents').select('id').eq('message_id', messageId).limit(1).maybeSingle();
    if (existingIntent) {
      return new Response(JSON.stringify({ success: true, intentId: existingIntent.id, skipped: 'already_interpreted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========================================
    // 3. PARSE CONTEXT (direct call, no HTTP)
    // ========================================
    const parsedContext = await loadFullContext(supabase, msg.id);

    // Check opt-out
    if (parsedContext.optOut) {
      log.info('Lead opt-out, skipping');
      return new Response(JSON.stringify({ success: true, optOutBlocked: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check manual mode
    const convState = parsedContext.conversationState;
    const isManualMode = (convState as Record<string, unknown> | null)?.modo === 'MANUAL';
    if (isManualMode && source !== 'BLUECHAT') {
      log.info('Manual mode — interpreting but suppressing response');
    }

    // ========================================
    // 4. CLASSIFY INTENT (direct call, no HTTP)
    // ========================================
    const classifierResult = await classifyIntent(supabase, {
      mensagem_normalizada: msg.conteudo,
      empresa: msg.empresa,
      historico: parsedContext.historico,
      classificacao: parsedContext.classificacao,
      conversation_state: parsedContext.conversationState,
      contato: parsedContext.contato,
      mode,
      triageSummary,
      leadNome: parsedContext.leadNome,
      cadenciaNome: parsedContext.cadenciaNome,
      pessoaContext: parsedContext.pessoaContext,
    });

    log.info('Intent classified', { intent: classifierResult.intent, confidence: classifierResult.confidence, acao: classifierResult.acao || classifierResult.acao_recomendada });

    // If manual mode, save and return without response
    if (isManualMode && source !== 'BLUECHAT') {
      const intentId = await saveInterpretation(supabase, msg, classifierResult, false, false, null);
      return new Response(JSON.stringify({ success: true, intentId, intent: classifierResult.intent, confidence: classifierResult.confidence, modoManual: true, message: 'Modo MANUAL ativo — resposta automática suprimida' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========================================
    // 5. SANITIZE RESPONSE (direct call, no HTTP)
    // ========================================
    let respostaTexto: string | null = classifierResult.resposta_sugerida || null;
    const deveResponder = classifierResult.deve_responder ?? false;
    const acao = classifierResult.acao || classifierResult.acao_recomendada || 'NENHUMA';

    // Anti-limbo patches — usar ia_null_count com threshold de 3
    const frameworkData = (parsedContext.conversationState as Record<string, unknown>)?.framework_data as Record<string, unknown> || {};
    const iaNullCount = (frameworkData.ia_null_count as number) || 0;
    const isFailedIntent = classifierResult.intent === 'NAO_ENTENDI' || classifierResult.intent === 'OUTRO';
    const ESCALATION_THRESHOLD = 3;

    if (source === 'BLUECHAT' && isFailedIntent) {
      const hasContext = (parsedContext.historico || []).length >= 2;
      const newCount = iaNullCount + 1;

      // Guardar novo count para o action-executor persistir
      classifierResult._ia_null_count_update = newCount;

      if (!hasContext && classifierResult.intent === 'NAO_ENTENDI') {
        // Primeira mensagem sem contexto: saudação
        respostaTexto = respostaTexto || 'Oi! Sou a Amélia, do comercial do Grupo Blue. Em que posso te ajudar?';
        classifierResult.deve_responder = true;
      } else if (newCount >= ESCALATION_THRESHOLD) {
        // 3+ falhas consecutivas: agora sim escala
        respostaTexto = respostaTexto || 'Hmm, deixa eu pedir ajuda de alguém da equipe. Já já entram em contato!';
        classifierResult.acao = 'ESCALAR_HUMANO';
        classifierResult.deve_responder = true;
        log.info('Anti-limbo: escalando após 3 falhas consecutivas', { iaNullCount: newCount });
      } else {
        // Falha 1 ou 2: pedir esclarecimento
        const clarificationMessages = [
          'Não entendi bem. Pode me explicar melhor o que você precisa?',
          'Ainda não consegui entender. Pode reformular de outra forma?',
        ];
        respostaTexto = respostaTexto || clarificationMessages[Math.min(newCount - 1, clarificationMessages.length - 1)];
        classifierResult.acao = 'ENVIAR_RESPOSTA_AUTOMATICA';
        classifierResult.deve_responder = true;
        log.info('Anti-limbo: pedindo esclarecimento', { iaNullCount: newCount });
      }
    } else if (source === 'BLUECHAT' && !isFailedIntent) {
      // IA entendeu: resetar contador
      if (iaNullCount > 0) {
        classifierResult._ia_null_count_update = 0;
        log.info('Anti-limbo: resetando ia_null_count', { previousCount: iaNullCount });
      }
    }

    // OUTRO com ESCALAR_HUMANO mas abaixo do threshold: converter para esclarecimento
    if (source === 'BLUECHAT' && classifierResult.intent === 'OUTRO' && classifierResult.acao === 'ESCALAR_HUMANO' && (iaNullCount + 1) < ESCALATION_THRESHOLD) {
      classifierResult.acao = 'ENVIAR_RESPOSTA_AUTOMATICA';
    }

    if (source === 'BLUECHAT' && acao === 'ESCALAR_HUMANO' && !respostaTexto) {
      respostaTexto = 'Vou te conectar com alguém da equipe que pode te ajudar melhor com isso!';
      classifierResult.deve_responder = true;
    }

    if (respostaTexto && (classifierResult.deve_responder || deveResponder)) {
      respostaTexto = sanitizeResponse(respostaTexto, parsedContext.leadNome || undefined);
    }

    // ========================================
    // 6. EXECUTE ACTIONS (direct call, no HTTP)
    // ========================================
    const finalAcao = classifierResult.acao || acao;
    const telefone = parsedContext.telefone;

    const canRespond = source === 'BLUECHAT'
      ? (classifierResult.deve_responder && respostaTexto && classifierResult.intent !== 'OPT_OUT')
      : (classifierResult.deve_responder && respostaTexto && telefone && classifierResult.intent !== 'OPT_OUT');

    const execResult = await executeActions(supabase, {
      lead_id: msg.lead_id,
      run_id: msg.run_id,
      empresa: msg.empresa,
      acao: finalAcao,
      acao_detalhes: classifierResult.acao_detalhes || {},
      telefone,
      resposta: canRespond ? respostaTexto : null,
      source,
      intent: classifierResult.intent,
      confidence: classifierResult.confidence,
      mensagem_original: msg.conteudo,
      novo_estado_funil: classifierResult.novo_estado_funil,
      frameworks_atualizados: classifierResult.frameworks_atualizados,
      disc_estimado: classifierResult.disc_estimado,
      ultima_pergunta_id: classifierResult.ultima_pergunta_id,
      conversation_state: parsedContext.conversationState,
      pessoaContext: parsedContext.pessoaContext,
      classificacao: parsedContext.classificacao,
      pipedriveDealeId: parsedContext.pipedriveDealeId,
      historico: parsedContext.historico as Record<string, unknown>[],
      classification_upgrade: classifierResult.classification_upgrade,
      _ia_null_count_update: classifierResult._ia_null_count_update,
    });

    // For BLUECHAT, response is returned via HTTP, not sent via WhatsApp
    const respostaEnviada = source === 'BLUECHAT' && canRespond ? false : execResult.respostaEnviada;

    // ========================================
    // 7. SAVE INTERPRETATION
    // ========================================
    const intentId = await saveInterpretation(supabase, msg, classifierResult, execResult.acaoAplicada, respostaEnviada, respostaTexto);

    // Log AI usage
    try {
      await supabase.from('ai_usage_log').insert({
        function_name: 'sdr-ia-interpret',
        provider: classifierResult.provider || 'unknown',
        model: classifierResult.model || 'unknown',
        success: true,
        latency_ms: 0,
        custo_estimado: 0,
        empresa: msg.empresa || null,
      });
    } catch { /* ignore */ }

    // ========================================
    // 8. RETURN RESULT
    // ========================================
    const needsEscalation = finalAcao === 'ESCALAR_HUMANO' || finalAcao === 'CRIAR_TAREFA_CLOSER';

    return new Response(JSON.stringify({
      success: true,
      intentId,
      intent: classifierResult.intent,
      confidence: classifierResult.confidence,
      acao: finalAcao,
      acaoAplicada: execResult.acaoAplicada,
      respostaEnviada,
      responseText: respostaTexto,
      leadReady: finalAcao === 'CRIAR_TAREFA_CLOSER',
      escalation: {
        needed: needsEscalation,
        reason: needsEscalation ? (finalAcao === 'CRIAR_TAREFA_CLOSER' ? 'Lead qualificado para closer' : 'Situação requer atenção humana') : undefined,
        priority: needsEscalation ? (finalAcao === 'CRIAR_TAREFA_CLOSER' ? 'HIGH' : 'MEDIUM') : undefined,
      },
      departamento_destino: needsEscalation ? (classifierResult.departamento_destino || 'Comercial') : null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
    log.error('Error', { error: errMsg });
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// ========================================
// SAVE INTERPRETATION
// ========================================
async function saveInterpretation(
  supabase: SupabaseClient,
  message: MessageRow,
  aiResponse: ClassifierResult,
  acaoAplicada: boolean,
  respostaEnviada: boolean,
  respostaTexto: string | null,
): Promise<string> {
  const record = {
    message_id: message.id,
    lead_id: message.lead_id,
    run_id: message.run_id,
    empresa: message.empresa,
    intent: aiResponse.intent || 'OUTRO',
    intent_confidence: aiResponse.confidence || 0.5,
    intent_summary: aiResponse.summary || aiResponse.resumo || null,
    acao_recomendada: normalizarAcao(aiResponse.acao || aiResponse.acao_recomendada),
    acao_aplicada: acaoAplicada,
    acao_detalhes: aiResponse.acao_detalhes || null,
    modelo_ia: aiResponse.model || 'unknown',
    tokens_usados: 0,
    tempo_processamento_ms: 0,
    resposta_automatica_texto: respostaTexto,
    resposta_enviada_em: respostaEnviada ? new Date().toISOString() : null,
    sentimento: aiResponse.sentimento || null,
  };

  const { data, error } = await supabase.from('lead_message_intents').insert(record).select('id').single();
  if (error) {
    log.error('Save error', { error: error.message });
    throw error;
  }
  return (data as { id: string }).id;
}
