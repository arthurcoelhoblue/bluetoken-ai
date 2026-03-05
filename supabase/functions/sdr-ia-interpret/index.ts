import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// SDR-IA INTERPRET — ORCHESTRATOR (Consolidated)
// Now imports modules directly instead of HTTP fetch()
// ========================================

import { getWebhookCorsHeaders } from "../_shared/cors.ts";
import { createServiceClient, envConfig } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import { isHorarioComercial } from "../_shared/business-hours.ts";

// Local modules (previously separate Edge Functions)
import { loadFullContext, type ParsedContext } from "./message-parser.ts";
import { classifyIntent, type ClassifierResult } from "./intent-classifier.ts";
import { sanitizeResponse, generateResponse } from "./response-generator.ts";
import { executeActions } from "./action-executor.ts";
import { handleMeetingScheduling, startMeetingScheduling } from "./meeting-scheduler.ts";

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
  source?: 'WHATSAPP' | string;
  mode?: 'PASSIVE_CHAT' | string;
  triageSummary?: { clienteNome: string | null; email: string | null; resumoTriagem: string | null; historico: string | null };
  testMode?: string;
  mensagens?: string[];
  reprocess?: boolean;
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
    const isReprocess = body.reprocess === true;

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
    if (isReprocess) {
      // Delete existing intent so we can reprocess
      await supabase.from('lead_message_intents').delete().eq('message_id', messageId);
      log.info('Reprocess mode: deleted existing intent for message', { messageId });
    } else {
      const { data: existingIntent } = await supabase.from('lead_message_intents').select('id').eq('message_id', messageId).limit(1).maybeSingle();
      if (existingIntent) {
        return new Response(JSON.stringify({ success: true, intentId: existingIntent.id, skipped: 'already_interpreted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
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

    // ========================================
    // 3b. MEETING SCHEDULING FLOW CHECK
    // ========================================
    const meetingCtx = {
      leadId: msg.lead_id,
      empresa: msg.empresa,
      contactId: (parsedContext.contato as Record<string, unknown>)?.id as string | undefined,
      dealId: parsedContext.deals?.[0] ? (parsedContext.deals[0] as Record<string, unknown>).id as string : undefined,
      ownerId: (parsedContext.deals?.[0] ? (parsedContext.deals[0] as Record<string, unknown>).owner_id as string : undefined) || (parsedContext.contato as Record<string, unknown>)?.owner_id as string || undefined,
      mensagem: msg.conteudo,
      telefone: parsedContext.telefone || undefined,
    };

    const meetingResult = await handleMeetingScheduling(supabase, meetingCtx);
    if (meetingResult.handled && meetingResult.response) {
      // Save as intent and send response
      const intentId = await saveInterpretation(supabase, msg, {
        intent: 'AGENDAMENTO_REUNIAO',
        confidence: 1.0,
        acao: 'ENVIAR_RESPOSTA_AUTOMATICA',
        deve_responder: true,
      } as ClassifierResult, true, true, meetingResult.response);
      return new Response(JSON.stringify({
        success: true, intentId,
        intent: 'AGENDAMENTO_REUNIAO', confidence: 1.0,
        acao: 'ENVIAR_RESPOSTA_AUTOMATICA', respostaEnviada: true,
        responseText: meetingResult.response,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check manual mode — skip when reprocessing (mode already switched to SDR_IA)
    const convStateRaw = parsedContext.conversationState;
    const isManualMode = !isReprocess && (convStateRaw as Record<string, unknown> | null)?.modo === 'MANUAL';
    if (isManualMode) {
      log.info('Manual mode — interpreting but suppressing response', { source });
    }

    // ========================================
    // 4. PRE-FETCH CONTEXT IN PARALLEL (RAG, offers, learnings)
    // ========================================
    let reprocessContext: string | undefined;
    if (isReprocess) {
      reprocessContext = `\n🔄 RETOMADA DE ATENDIMENTO: Este lead estava sendo atendido manualmente por um humano e AGORA FOI DEVOLVIDO PARA VOCÊ (Amélia). VOCÊ É A ATENDENTE AGORA. NÃO escale, NÃO transfira, NÃO diga que vai chamar alguém. Continue a conversa naturalmente a partir do contexto existente. Analise o histórico e dê continuidade ao atendimento.\n`;
    }

    const foraDoHorario = !isHorarioComercial();
    log.info('Horário comercial check', { foraDoHorario });

    // Centralized parallel pre-fetch: RAG + Tokeniza offers + learnings
    const ragFetchPromise = (async (): Promise<{ context: string | null; chunks: any[]; searchMethod: string }> => {
      try {
        const resp = await fetch(`${envConfig.SUPABASE_URL}/functions/v1/knowledge-search`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${envConfig.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: msg.conteudo, empresa: msg.empresa, top_k: 5, threshold: 0.70 }),
        });
        if (!resp.ok) return { context: null, chunks: [], searchMethod: '' };
        const data = await resp.json();
        const context = (data.context && data.total > 0)
          ? `\n## CONHECIMENTO RELEVANTE (RAG - ${data.total} trechos)\n${data.context}\n`
          : null;
        return { context, chunks: data.chunks || [], searchMethod: data.search_method || 'semantic' };
      } catch { return { context: null, chunks: [], searchMethod: '' }; }
    })();

    const offersFetchPromise = msg.empresa === 'TOKENIZA'
      ? (async () => {
          try {
            const resp = await fetch(`${envConfig.SUPABASE_URL}/functions/v1/tokeniza-offers`, {
              headers: { 'Authorization': `Bearer ${envConfig.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
            });
            if (!resp.ok) return [];
            const data = await resp.json();
            return (data.ofertas || []).filter((o: any) => o.status?.toLowerCase() === 'active' || o.status?.toLowerCase() === 'open');
          } catch { return []; }
        })()
      : Promise.resolve(null);

    const learningsFetchPromise = (async () => {
      try {
        const { data } = await supabase.from('amelia_learnings').select('titulo, descricao, tipo').eq('empresa', msg.empresa).eq('status', 'VALIDADO').eq('aplicado', true).limit(5);
        return (data || []) as Array<{ tipo: string; titulo: string; descricao: string }>;
      } catch { return []; }
    })();

    const [ragResult, tokenizaOffers, learnings] = await Promise.all([
      ragFetchPromise,
      offersFetchPromise,
      learningsFetchPromise,
    ]);

    log.info('Pre-fetch complete', { ragFound: !!ragResult.context, ragChunks: ragResult.chunks.length, offersCount: tokenizaOffers?.length ?? 0, learningsCount: learnings.length });

    // ========================================
    // 4b. CLASSIFY INTENT (with pre-fetched context)
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
      reprocessContext,
      foraDoHorario,
      // Pass pre-fetched context to avoid duplicate fetches
      preloadedRagContext: ragResult.context,
      preloadedTokenizaOffers: tokenizaOffers,
      preloadedLearnings: learnings,
    });

    log.info('Intent classified', { intent: classifierResult.intent, confidence: classifierResult.confidence, acao: classifierResult.acao || classifierResult.acao_recomendada });

    // ========================================
    // 4c. START MEETING SCHEDULING IF INTENT = AGENDAMENTO_REUNIAO
    // ========================================
    if (classifierResult.intent === 'AGENDAMENTO_REUNIAO' && !meetingResult.handled) {
      log.info('Intent AGENDAMENTO_REUNIAO detected, starting scheduling flow', { leadId: msg.lead_id, ownerId: meetingCtx.ownerId });
      const startResult = await startMeetingScheduling(supabase, meetingCtx);
      if (startResult.handled && startResult.response) {
        const intentId = await saveInterpretation(supabase, msg, {
          intent: 'AGENDAMENTO_REUNIAO',
          confidence: classifierResult.confidence,
          acao: startResult.action === 'ESCALAR_HUMANO' ? 'ESCALAR_HUMANO' : 'ENVIAR_RESPOSTA_AUTOMATICA',
          deve_responder: true,
        } as ClassifierResult, true, true, startResult.response);

        // Send response via WhatsApp
        const telefone = parsedContext.telefone;
        if (telefone) {
          await executeActions(supabase, {
            lead_id: msg.lead_id,
            run_id: msg.run_id,
            empresa: msg.empresa,
            acao: startResult.action === 'ESCALAR_HUMANO' ? 'ESCALAR_HUMANO' : 'ENVIAR_RESPOSTA_AUTOMATICA',
            acao_detalhes: { intent: 'AGENDAMENTO_REUNIAO' },
            telefone,
            resposta: startResult.response,
            source,
            intent: 'AGENDAMENTO_REUNIAO',
            confidence: classifierResult.confidence,
            mensagem_original: msg.conteudo,
            conversation_state: parsedContext.conversationState,
            historico: parsedContext.historico as Record<string, unknown>[],
          });
        }

        return new Response(JSON.stringify({
          success: true, intentId,
          intent: 'AGENDAMENTO_REUNIAO',
          confidence: classifierResult.confidence,
          acao: startResult.action === 'ESCALAR_HUMANO' ? 'ESCALAR_HUMANO' : 'ENVIAR_RESPOSTA_AUTOMATICA',
          respostaEnviada: !!telefone,
          responseText: startResult.response,
          meetingSchedulingStarted: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // If manual mode, save and return without response
    if (isManualMode) {
      const intentId = await saveInterpretation(supabase, msg, classifierResult, false, false, null);
      return new Response(JSON.stringify({ success: true, intentId, intent: classifierResult.intent, confidence: classifierResult.confidence, modoManual: true, message: 'Modo MANUAL ativo — resposta automática suprimida' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========================================
    // 5. GENERATE RESPONSE VIA SONNET (not from classifier)
    // ========================================
    let respostaTexto: string | null = null;
    const deveResponder = classifierResult.deve_responder ?? false;

    // Normalize actions BEFORE anti-limbo logic so invalid actions are handled correctly
    if (classifierResult.acao) {
      classifierResult.acao = normalizarAcao(classifierResult.acao);
    }
    if (classifierResult.acao_recomendada) {
      classifierResult.acao_recomendada = normalizarAcao(classifierResult.acao_recomendada);
    }

    const acao = classifierResult.acao || classifierResult.acao_recomendada || 'NENHUMA';

    // Anti-limbo patches — usar ia_null_count com threshold de 3
    const frameworkData = (parsedContext.conversationState as Record<string, unknown>)?.framework_data as Record<string, unknown> || {};
    const iaNullCount = (frameworkData.ia_null_count as number) || 0;

    // Check if classifier flagged this as a contextual short reply (numeral answer to outbound question)
    const isContextualShortReply = !!(classifierResult as Record<string, unknown>)._isContextualShortReply;

    // Phase 3: Semantic signal detection — clear product/price/process questions should never be "não entendi"
    const msgLowerForSignal = msg.conteudo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const hasClearSemanticSignal = /como|preco|pre[cç]o|suporte|exchange|ir |declarar|imposto|plano|quanto|investir|rentabilidade|cripto|bitcoin|carteira|opera[cç]/.test(msgLowerForSignal);
    const isDeterministicFallback = !!(classifierResult as Record<string, unknown>)._fallbackReason;

    // Improved: OUTRO with high confidence + valid response = progress, not failure
    // Also: if clear semantic signal present OR deterministic fallback, don't treat as comprehension failure
    const isFailedIntent = !isContextualShortReply && !hasClearSemanticSignal && !isDeterministicFallback && (
      classifierResult.intent === 'NAO_ENTENDI'
      || (classifierResult.intent === 'OUTRO' && classifierResult.confidence < 0.8)
    );
    const ESCALATION_THRESHOLD = 3;

    // Check if conversation is advanced enough to skip anti-limbo clarifications
    const convStateAntiLimbo = parsedContext.conversationState as Record<string, unknown> || {};
    const estadoFunil = convStateAntiLimbo.estado_funil as string || '';
    const spinData = (frameworkData.spin || frameworkData.SPIN) as Record<string, unknown> || {};
    const spinFilled = !!(spinData.s && spinData.p);
    const isAdvancedFunnel = ['FECHAMENTO', 'NEGOCIACAO', 'PROPOSTA', 'SQL'].includes(estadoFunil);

    // Log decision context for observability
    log.info('Anti-limbo context', {
      messageId, leadId: msg.lead_id, estadoFunil, iaNullCount,
      isContextualShortReply, isFailedIntent, isAdvancedFunnel, spinFilled,
      hasClearSemanticSignal, isDeterministicFallback,
      intent: classifierResult.intent, confidence: classifierResult.confidence,
    });

    if (isContextualShortReply) {
      if (iaNullCount > 0) {
        classifierResult._ia_null_count_update = Math.max(0, iaNullCount - 1);
      }
      log.info('Anti-limbo: resposta curta contextual detectada — tratando como progresso', {
        intent: classifierResult.intent, confidence: classifierResult.confidence,
      });
    } else if (isDeterministicFallback && hasClearSemanticSignal) {
      classifierResult.acao = 'ENVIAR_RESPOSTA_AUTOMATICA';
      classifierResult.deve_responder = true;
      if (iaNullCount > 0) {
        classifierResult._ia_null_count_update = Math.max(0, iaNullCount - 1);
      }
      if (!respostaTexto || respostaTexto.length <= 20 || respostaTexto.toLowerCase().includes('reformul') || respostaTexto.toLowerCase().includes('não entendi')) {
        respostaTexto = msg.empresa === 'BLUE'
          ? 'Boa pergunta! Posso te explicar melhor como funciona. O que exatamente você gostaria de saber?'
          : 'Ótima dúvida! Deixa eu te explicar com mais detalhes. Qual ponto específico te interessa?';
      }
      log.info('Anti-limbo: fallback determinístico com sinal semântico claro — tratando como progresso', {
        fallbackReason: (classifierResult as Record<string, unknown>)._fallbackReason,
        semanticSignal: true,
      });
    } else if (isFailedIntent) {
      const hasContext = (parsedContext.historico || []).length >= 2;
      const newCount = iaNullCount + 1;

      if (isAdvancedFunnel && spinFilled && respostaTexto && respostaTexto.length > 20) {
        classifierResult.acao = 'ENVIAR_RESPOSTA_AUTOMATICA';
        classifierResult.deve_responder = true;
        classifierResult._ia_null_count_update = Math.max(0, iaNullCount - 1);
        log.info('Anti-limbo: funil avançado, usando resposta IA em vez de clarificação', { estadoFunil, iaNullCount, spinFilled });
      } else if (!hasContext && classifierResult.intent === 'NAO_ENTENDI') {
        classifierResult._ia_null_count_update = newCount;
        respostaTexto = respostaTexto || 'Oi! Sou a Amélia, do comercial do Grupo Blue. Em que posso te ajudar?';
        classifierResult.deve_responder = true;
      } else if (newCount >= ESCALATION_THRESHOLD) {
        classifierResult._ia_null_count_update = newCount;
        respostaTexto = respostaTexto || 'Hmm, deixa eu pedir ajuda de alguém da equipe. Já já entram em contato!';
        classifierResult.acao = 'ESCALAR_HUMANO';
        classifierResult.deve_responder = true;
        log.info('Anti-limbo: escalando após 3 falhas consecutivas', { iaNullCount: newCount });
      } else {
        classifierResult._ia_null_count_update = newCount;
        const clarificationMessages = [
          'Não entendi bem. Pode me explicar melhor o que você precisa?',
          'Ainda não consegui entender. Pode reformular de outra forma?',
        ];
        respostaTexto = respostaTexto || clarificationMessages[Math.min(newCount - 1, clarificationMessages.length - 1)];
        classifierResult.acao = 'ENVIAR_RESPOSTA_AUTOMATICA';
        classifierResult.deve_responder = true;
        log.info('Anti-limbo: pedindo esclarecimento', { iaNullCount: newCount });
      }
    } else if (!isFailedIntent) {
      if (iaNullCount > 0) {
        classifierResult._ia_null_count_update = Math.max(0, iaNullCount - 1);
        log.info('Anti-limbo: decaying ia_null_count', { previousCount: iaNullCount, newCount: iaNullCount - 1 });
      }
    }

    // OUTRO com ESCALAR_HUMANO mas abaixo do threshold: converter para esclarecimento
    if (classifierResult.intent === 'OUTRO' && classifierResult.acao === 'ESCALAR_HUMANO' && (iaNullCount + 1) < ESCALATION_THRESHOLD) {
      classifierResult.acao = 'ENVIAR_RESPOSTA_AUTOMATICA';
    }

    if (acao === 'ESCALAR_HUMANO' && !respostaTexto) {
      respostaTexto = 'Vou te conectar com alguém da equipe que pode te ajudar melhor com isso!';
      classifierResult.deve_responder = true;
    }

    // ========================================
    // 5a. GENERATE RESPONSE VIA SONNET (when deve_responder and no static override)
    // ========================================
    if ((classifierResult.deve_responder || deveResponder) && !respostaTexto) {
      try {
        log.info('Generating response via Sonnet (generateResponse)', { intent: classifierResult.intent, disc: classifierResult.disc_estimado });
        const genResult = await generateResponse(supabase, {
          intent: classifierResult.intent,
          confidence: classifierResult.confidence,
          temperatura: (parsedContext.classificacao as Record<string, unknown>)?.temperatura as string || 'MORNO',
          sentimento: classifierResult.sentimento,
          acao_recomendada: classifierResult.acao || classifierResult.acao_recomendada,
          mensagem_normalizada: msg.conteudo,
          empresa: msg.empresa,
          canal: 'WHATSAPP',
          contato: parsedContext.contato as Record<string, unknown> | undefined,
          classificacao: parsedContext.classificacao as Record<string, unknown> | undefined,
          conversation_state: {
            ...(parsedContext.conversationState as Record<string, unknown> || {}),
            perfil_disc: classifierResult.disc_estimado || (parsedContext.conversationState as Record<string, unknown>)?.perfil_disc,
          },
          historico: parsedContext.historico as { direcao: string; conteudo: string }[],
          // Pass pre-fetched RAG context to avoid duplicate fetch
          preloadedRagContext: ragResult.context ? ragResult.context.replace(/\n## CONHECIMENTO RELEVANTE \(RAG - \d+ trechos\)\n/, '') : null,
          preloadedRagChunks: ragResult.chunks,
          preloadedRagSearchMethod: ragResult.searchMethod,
        });
        respostaTexto = genResult.resposta;
        log.info('Sonnet response generated', { length: respostaTexto?.length, model: genResult.model });
      } catch (genError) {
        log.error('generateResponse failed, using fallback', { error: genError instanceof Error ? genError.message : String(genError) });
        respostaTexto = `Olá${parsedContext.leadNome ? ` ${parsedContext.leadNome}` : ''}! Recebi sua mensagem. Vou encaminhar para um especialista que pode te ajudar melhor. 😊`;
      }
    }

    if (respostaTexto && (classifierResult.deve_responder || deveResponder)) {
      respostaTexto = sanitizeResponse(respostaTexto, parsedContext.leadNome || undefined);
    }

    // ========================================
    // 5b. GUARDRAIL: Fora do horário comercial → bloquear ESCALAR_HUMANO
    // ========================================
    let finalAcao = classifierResult.acao || acao;
    if (foraDoHorario && (finalAcao === 'ESCALAR_HUMANO' || finalAcao === 'CRIAR_TAREFA_CLOSER')) {
      log.info('Guardrail fora do horário: convertendo escalação para resposta automática', { acaoOriginal: finalAcao });
      finalAcao = 'ENVIAR_RESPOSTA_AUTOMATICA';
      classifierResult.acao = 'ENVIAR_RESPOSTA_AUTOMATICA';
      classifierResult.deve_responder = true;
      if (!respostaTexto || respostaTexto.includes('conectar') || respostaTexto.includes('chamar') || respostaTexto.includes('momento')) {
        respostaTexto = 'Nosso time não está disponível agora (atendemos de seg a sex, 8h às 18h), mas posso te ajudar com tudo! Como posso te ajudar? 😊';
      }
    }

    // ========================================
    // 6. EXECUTE ACTIONS (direct call, no HTTP)
    // ========================================
    const telefone = parsedContext.telefone;

    const canRespond = classifierResult.deve_responder && respostaTexto && telefone && classifierResult.intent !== 'OPT_OUT';

    const execResult = await executeActions(supabase, {
      lead_id: msg.lead_id,
      run_id: msg.run_id,
      empresa: msg.empresa,
      acao: finalAcao,
      acao_detalhes: { ...(classifierResult.acao_detalhes || {}), intent: classifierResult.intent },
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
      lead_facts_extraidos: classifierResult.lead_facts_extraidos,
    });

    const respostaEnviada = execResult.respostaEnviada;

    // ========================================
    // 7. SAVE + LOG + FEEDBACK IN PARALLEL
    // ========================================
    const [saveResult] = await Promise.allSettled([
      saveInterpretation(supabase, msg, classifierResult, execResult.acaoAplicada, respostaEnviada, respostaTexto),
      supabase.from('ai_usage_log').insert({
        function_name: 'sdr-ia-interpret',
        provider: classifierResult.provider || 'unknown',
        model: classifierResult.model || 'unknown',
        success: true,
        latency_ms: 0,
        custo_estimado: 0,
        empresa: msg.empresa || null,
      }).then(() => {}),
      autoClassifyPreviousFeedback(supabase, msg.lead_id, msg.empresa, classifierResult.intent, msg.conteudo)
        .catch((e: unknown) => log.error('Auto-classify feedback failed', { error: e instanceof Error ? e.message : String(e) })),
    ]);

    const intentId = saveResult.status === 'fulfilled' ? saveResult.value : 'unknown';

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
// AUTO-CLASSIFY PREVIOUS FEEDBACK
// Infers UTIL/NAO_UTIL based on lead's follow-up behavior
// ========================================
async function autoClassifyPreviousFeedback(
  supabase: SupabaseClient,
  leadId: string,
  empresa: string,
  currentIntent: string,
  currentMessage: string,
): Promise<void> {
  // Find the most recent PENDENTE feedback for this lead (last 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: pendingFeedback } = await supabase
    .from('knowledge_search_feedback')
    .select('id, query, chunks_returned')
    .eq('lead_id', leadId)
    .eq('empresa', empresa)
    .eq('outcome', 'PENDENTE')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(3);

  if (!pendingFeedback || pendingFeedback.length === 0) return;

  const msgLower = currentMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Signals that previous RAG response was NOT useful
  const naoUtilSignals = [
    'nao entendi', 'não entendi', 'como assim', 'pode explicar',
    'nao foi isso', 'não foi isso', 'errado', 'incorreto',
    'repete', 'repetir', 'de novo', 'novamente',
    'não é isso', 'nao e isso', 'não era isso',
  ];
  const isNaoUtil = naoUtilSignals.some(s => msgLower.includes(s));

  // Signals that previous RAG response WAS useful: lead progresses
  const utilIntents = ['INTERESSE_COMPRA', 'INTERESSE_IR', 'AGENDAMENTO_REUNIAO', 'SOLICITACAO_CONTATO', 'DUVIDA_PRECO', 'DUVIDA_PRODUTO', 'DUVIDA_TECNICA', 'AGRADECIMENTO'];
  const isUtil = utilIntents.includes(currentIntent) || currentIntent === 'CUMPRIMENTO';

  // Lead repeating similar query = NAO_UTIL
  let isRepeat = false;
  for (const fb of pendingFeedback) {
    const prevQuery = ((fb as any).query || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (prevQuery && msgLower.length > 5 && prevQuery.length > 5) {
      // Simple overlap check: if >60% of words match
      const prevWords = new Set(prevQuery.split(/\s+/).filter((w: string) => w.length > 3));
      const curWords = msgLower.split(/\s+/).filter((w: string) => w.length > 3);
      if (prevWords.size > 0 && curWords.length > 0) {
        const overlap = curWords.filter((w: string) => prevWords.has(w)).length;
        if (overlap / Math.max(prevWords.size, curWords.length) > 0.6) {
          isRepeat = true;
          break;
        }
      }
    }
  }

  let outcome: string | null = null;
  if (isNaoUtil || isRepeat) {
    outcome = 'NAO_UTIL';
  } else if (isUtil) {
    outcome = 'UTIL';
  }

  if (outcome) {
    const ids = pendingFeedback.map((fb: any) => fb.id);
    await supabase
      .from('knowledge_search_feedback')
      .update({ outcome, classified_at: new Date().toISOString() })
      .in('id', ids);
    log.info('Auto-classified feedback', { count: ids.length, outcome, leadId });
  }
}

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
