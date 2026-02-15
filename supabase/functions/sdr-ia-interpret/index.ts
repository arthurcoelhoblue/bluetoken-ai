import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// SDR-IA INTERPRET — ORCHESTRATOR (~250 lines)
// Calls: sdr-message-parser → sdr-intent-classifier → sdr-response-generator → sdr-action-executor
// ========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InterpretRequest {
  messageId: string;
  source?: 'BLUECHAT' | 'WHATSAPP' | string;
  mode?: 'PASSIVE_CHAT' | string;
  triageSummary?: { clienteNome: string | null; email: string | null; resumoTriagem: string | null; historico: string | null };
  testMode?: string;
  mensagens?: string[];
}

const SUPABASE_URL = () => Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function callFunction(name: string, body: any): Promise<any> {
  const resp = await fetch(`${SUPABASE_URL()}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SERVICE_KEY()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`[Orchestrator] ${name} failed (${resp.status}):`, err);
    throw new Error(`${name} failed: ${resp.status}`);
  }
  return resp.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json() as InterpretRequest;

    // Test mode (urgency detection — kept for backward compat)
    if (body.testMode === 'urgencia') {
      return callFunction('sdr-intent-classifier', { mensagem_normalizada: 'test', empresa: 'BLUE', testMode: 'urgencia', mensagens: body.mensagens })
        .then(r => new Response(JSON.stringify(r), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }))
        .catch(() => new Response(JSON.stringify({ testMode: 'urgencia', error: 'classifier unavailable' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }));
    }

    const { messageId, source, mode, triageSummary } = body;
    if (!messageId) return new Response(JSON.stringify({ error: 'messageId obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(SUPABASE_URL(), SERVICE_KEY());

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

    // ========================================
    // 2. QUICK CHECKS: duplicate, opt-out, manual mode
    // ========================================
    const { data: existingIntent } = await supabase.from('lead_message_intents').select('id').eq('message_id', messageId).limit(1).maybeSingle();
    if (existingIntent) {
      return new Response(JSON.stringify({ success: true, intentId: existingIntent.id, skipped: 'already_interpreted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========================================
    // 3. CALL sdr-message-parser
    // ========================================
    const parsedContext = await callFunction('sdr-message-parser', {
      lead_id: message.lead_id,
      empresa: message.empresa,
      messageId: message.id,
      run_id: message.run_id,
    });

    // Check opt-out
    if (parsedContext.optOut) {
      console.log('[Orchestrator] Lead opt-out, skipping');
      return new Response(JSON.stringify({ success: true, optOutBlocked: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check manual mode — still classify but don't send response
    const isManualMode = parsedContext.conversation_state?.modo === 'MANUAL';
    // Also check if cadence is paused due to manual mode
    if (isManualMode && source !== 'BLUECHAT') {
      // Save interpretation but suppress auto-response
      console.log('[Orchestrator] Manual mode — interpreting but suppressing response');
    }

    // ========================================
    // 4. CALL sdr-intent-classifier
    // ========================================
    const classifierResult = await callFunction('sdr-intent-classifier', {
      mensagem_normalizada: message.conteudo,
      empresa: message.empresa,
      historico: parsedContext.historico || [],
      classificacao: parsedContext.classificacao,
      conversation_state: parsedContext.conversation_state,
      contato: parsedContext.contato,
      mode,
      triageSummary,
      leadNome: parsedContext.leadNome,
      cadenciaNome: parsedContext.cadenciaNome,
      pessoaContext: parsedContext.pessoaContext,
    });

    console.log('[Orchestrator] Intent:', { intent: classifierResult.intent, confidence: classifierResult.confidence, acao: classifierResult.acao || classifierResult.acao_recomendada });

    // If manual mode, save and return without response
    if (isManualMode && source !== 'BLUECHAT') {
      const intentId = await saveInterpretation(supabase, message, classifierResult, false, false, null);
      return new Response(JSON.stringify({ success: true, intentId, intent: classifierResult.intent, confidence: classifierResult.confidence, modoManual: true, message: 'Modo MANUAL ativo — resposta automática suprimida' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========================================
    // 5. CALL sdr-response-generator (sanitize response)
    // ========================================
    let respostaTexto: string | null = classifierResult.resposta_sugerida || null;
    const deveResponder = classifierResult.deve_responder ?? false;
    const acao = classifierResult.acao || classifierResult.acao_recomendada || 'NENHUMA';

    // Anti-limbo patches for BLUECHAT
    if (source === 'BLUECHAT' && classifierResult.intent === 'NAO_ENTENDI') {
      const hasContext = (parsedContext.historico || []).length >= 2;
      if (!hasContext) {
        respostaTexto = respostaTexto || 'Oi! Sou a Amélia, do comercial do Grupo Blue. Em que posso te ajudar?';
        classifierResult.deve_responder = true;
      } else {
        respostaTexto = respostaTexto || 'Hmm, deixa eu pedir ajuda de alguém da equipe. Já já entram em contato!';
        classifierResult.acao = 'ESCALAR_HUMANO';
        classifierResult.deve_responder = true;
      }
    }

    if (source === 'BLUECHAT' && acao === 'ESCALAR_HUMANO' && !respostaTexto) {
      respostaTexto = 'Vou te conectar com alguém da equipe que pode te ajudar melhor com isso!';
      classifierResult.deve_responder = true;
    }

    if (respostaTexto && (classifierResult.deve_responder || deveResponder)) {
      try {
        const genResult = await callFunction('sdr-response-generator', {
          resposta_sugerida: respostaTexto,
          leadNome: parsedContext.leadNome,
          empresa: message.empresa,
          canal: parsedContext.conversation_state?.canal || 'WHATSAPP',
          intent: classifierResult.intent,
        });
        respostaTexto = genResult.resposta_sanitizada || respostaTexto;
      } catch (genErr) {
        console.warn('[Orchestrator] response-generator failed, using raw:', genErr);
      }
    }

    // ========================================
    // 6. CALL sdr-action-executor
    // ========================================
    let acaoAplicada = false;
    let respostaEnviada = false;
    const finalAcao = classifierResult.acao || acao;
    const telefone = parsedContext.telefone;

    // Determine if we should send response
    const canRespond = source === 'BLUECHAT'
      ? (classifierResult.deve_responder && respostaTexto && classifierResult.intent !== 'OPT_OUT')
      : (classifierResult.deve_responder && respostaTexto && telefone && classifierResult.intent !== 'OPT_OUT');

    try {
      const execResult = await callFunction('sdr-action-executor', {
        lead_id: message.lead_id,
        run_id: message.run_id,
        empresa: message.empresa,
        acao: finalAcao,
        acao_detalhes: classifierResult.acao_detalhes || {},
        telefone,
        resposta: canRespond ? respostaTexto : null,
        source,
        intent: classifierResult.intent,
        confidence: classifierResult.confidence,
        mensagem_original: message.conteudo,
        // State updates
        novo_estado_funil: classifierResult.novo_estado_funil,
        frameworks_atualizados: classifierResult.frameworks_atualizados,
        disc_estimado: classifierResult.disc_estimado,
        ultima_pergunta_id: classifierResult.ultima_pergunta_id,
        conversation_state: parsedContext.conversation_state,
        pessoaContext: parsedContext.pessoaContext,
        classificacao: parsedContext.classificacao,
        pipedriveDealeId: parsedContext.pipedriveDealeId,
        historico: parsedContext.historico,
        classification_upgrade: classifierResult.classification_upgrade,
      });

      acaoAplicada = execResult.acaoAplicada ?? false;
      respostaEnviada = execResult.respostaEnviada ?? false;
    } catch (execErr) {
      console.error('[Orchestrator] action-executor failed:', execErr);
    }

    // For BLUECHAT, response is returned via HTTP, not sent via WhatsApp
    if (source === 'BLUECHAT' && canRespond && !respostaEnviada) {
      respostaEnviada = false; // Text is available but not sent via WhatsApp
    }

    // ========================================
    // 7. SAVE INTERPRETATION
    // ========================================
    const intentId = await saveInterpretation(supabase, message, classifierResult, acaoAplicada, respostaEnviada, respostaTexto);

    // Log AI usage
    try {
      await supabase.from('ai_usage_log').insert({
        function_name: 'sdr-ia-interpret',
        provider: classifierResult.provider || 'unknown',
        model: classifierResult.model || 'unknown',
        success: true,
        latency_ms: 0,
        custo_estimado: 0,
        empresa: message.empresa || null,
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
      acaoAplicada,
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
    console.error('[Orchestrator] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// ========================================
// SAVE INTERPRETATION (kept in orchestrator)
// ========================================
async function saveInterpretation(
  supabase: SupabaseClient,
  message: any,
  aiResponse: any,
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
    acao_recomendada: aiResponse.acao || aiResponse.acao_recomendada || 'NENHUMA',
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
    console.error('[Orchestrator] Save error:', error);
    throw error;
  }
  return (data as { id: string }).id;
}
