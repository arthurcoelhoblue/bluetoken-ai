import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envConfig, createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('sdr-action-executor');
const corsHeaders = getWebhookCorsHeaders();

// ========================================
// APPLY ACTION (from monolith)
// ========================================

async function applyAction(
  supabase: SupabaseClient,
  runId: string | null,
  leadId: string | null,
  empresa: string,
  acao: string,
  detalhes?: Record<string, unknown>,
  mensagemOriginal?: string
): Promise<boolean> {
  if (acao === 'NENHUMA' || acao === 'ENVIAR_RESPOSTA_AUTOMATICA') return false;
  if (!runId && !leadId) return false;

  const now = new Date().toISOString();

  switch (acao) {
    case 'PAUSAR_CADENCIA':
      if (runId) {
        await supabase.from('lead_cadence_runs').update({ status: 'PAUSADA', updated_at: now }).eq('id', runId).eq('status', 'ATIVA');
        await supabase.from('lead_cadence_events').insert({ lead_cadence_run_id: runId, step_ordem: 0, template_codigo: 'SDR_IA_ACAO', tipo_evento: 'RESPOSTA_DETECTADA', detalhes: { acao, motivo: 'Pausado automaticamente pela IA SDR' } });
        return true;
      }
      break;

    case 'CANCELAR_CADENCIA':
      if (runId) {
        await supabase.from('lead_cadence_runs').update({ status: 'CANCELADA', updated_at: now }).eq('id', runId).in('status', ['ATIVA', 'PAUSADA']);
        await supabase.from('lead_cadence_events').insert({ lead_cadence_run_id: runId, step_ordem: 0, template_codigo: 'SDR_IA_ACAO', tipo_evento: 'RESPOSTA_DETECTADA', detalhes: { acao, motivo: 'Cancelado automaticamente pela IA SDR' } });
        return true;
      }
      break;

    case 'MARCAR_OPT_OUT':
      if (leadId) {
        await supabase.from('lead_contacts').update({ opt_out: true, opt_out_em: now, opt_out_motivo: mensagemOriginal?.substring(0, 500) || 'Solicitado via mensagem', updated_at: now }).eq('lead_id', leadId).eq('empresa', empresa);
        const { data: activeRuns } = await supabase.from('lead_cadence_runs').select('id').eq('lead_id', leadId).in('status', ['ATIVA', 'PAUSADA']);
        if (activeRuns?.length) {
          const runIds = activeRuns.map((r: { id: string }) => r.id);
          await supabase.from('lead_cadence_runs').update({ status: 'CANCELADA', updated_at: now }).in('id', runIds);
          for (const rid of runIds) {
            await supabase.from('lead_cadence_events').insert({ lead_cadence_run_id: rid, step_ordem: 0, template_codigo: 'SDR_IA_OPT_OUT', tipo_evento: 'RESPOSTA_DETECTADA', detalhes: { acao, motivo: 'Lead solicitou opt-out' } });
          }
        }
        await supabase.from('lead_classifications').update({ temperatura: 'FRIO', updated_at: now }).eq('lead_id', leadId);
        return true;
      }
      break;

    case 'ESCALAR_HUMANO':
      if (leadId) {
        await supabase.from('lead_conversation_state').update({ modo: 'MANUAL', updated_at: now }).eq('lead_id', leadId).eq('empresa', empresa);
        return true;
      }
      break;

    case 'CRIAR_TAREFA_CLOSER':
      if (runId) {
        await supabase.from('lead_cadence_events').insert({ lead_cadence_run_id: runId, step_ordem: 0, template_codigo: 'SDR_IA_TAREFA_CLOSER', tipo_evento: 'RESPOSTA_DETECTADA', detalhes: { acao, motivo: 'Lead qualificado pelo SDR IA', prioridade: 'ALTA', ...detalhes } });
        await supabase.from('lead_cadence_runs').update({ status: 'PAUSADA', updated_at: now }).eq('id', runId).eq('status', 'ATIVA');
      }
      if (leadId) {
        // Notify closer
        const supabaseUrl = envConfig.SUPABASE_URL;
        const serviceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;
        try {
          await fetch(`${supabaseUrl}/functions/v1/notify-closer`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_id: leadId, empresa, motivo: (detalhes as any)?.motivo || 'Lead qualificado pelo SDR IA' }),
          });
        } catch { /* ignore */ }

        // Set MANUAL mode
        await supabase.from('lead_conversation_state').update({ modo: 'MANUAL', updated_at: now }).eq('lead_id', leadId).eq('empresa', empresa);

        // Auto-create deal
        await autoCreateDeal(supabase, leadId, empresa, detalhes);
        return true;
      }
      break;

    case 'AJUSTAR_TEMPERATURA':
      if (leadId && detalhes?.nova_temperatura) {
        await supabase.from('lead_classifications').update({ temperatura: detalhes.nova_temperatura, updated_at: now }).eq('lead_id', leadId).eq('empresa', empresa);
        return true;
      }
      break;

    case 'DESQUALIFICAR_LEAD':
      if (leadId) {
        await supabase.from('lead_classifications').update({ temperatura: 'FRIO', updated_at: now }).eq('lead_id', leadId).eq('empresa', empresa);
        const { data: runs } = await supabase.from('lead_cadence_runs').select('id').eq('lead_id', leadId).eq('status', 'ATIVA');
        if (runs?.length) {
          await supabase.from('lead_cadence_runs').update({ status: 'CANCELADA', updated_at: now }).in('id', runs.map((r: { id: string }) => r.id));
        }
        return true;
      }
      break;
  }
  return false;
}

// ========================================
// AUTO-CREATE DEAL (from monolith Sprint 2)
// ========================================

async function autoCreateDeal(supabase: SupabaseClient, leadId: string, empresa: string, detalhes?: Record<string, unknown>) {
  try {
    const { data: contact } = await supabase.from('contacts').select('id, nome').eq('legacy_lead_id', leadId).maybeSingle();
    if (!contact) return;

    const { data: pipeline } = await supabase.from('pipelines').select('id').eq('empresa', empresa).eq('is_default', true).eq('ativo', true).maybeSingle();
    if (!pipeline) return;

    const { data: existingDeal } = await supabase.from('deals').select('id').eq('contact_id', (contact as Record<string, unknown>).id as string).eq('pipeline_id', (pipeline as Record<string, unknown>).id as string).eq('status', 'ABERTO').maybeSingle();
    if (existingDeal) return;

    const { data: firstStage } = await supabase.from('pipeline_stages').select('id').eq('pipeline_id', (pipeline as Record<string, unknown>).id as string).eq('is_won', false).eq('is_lost', false).order('posicao', { ascending: true }).limit(1).maybeSingle();
    if (!firstStage) return;

    const valorMencionado = (detalhes as Record<string, unknown> | undefined)?.valor_mencionado as number | undefined;
    const necessidade = (detalhes as Record<string, unknown> | undefined)?.necessidade_principal as string | undefined;
    const urgencia = (detalhes as Record<string, unknown> | undefined)?.urgencia as string | undefined;
    const temperatura = urgencia === 'ALTA' ? 'QUENTE' : 'QUENTE';
    const contactName = (contact as Record<string, unknown>).nome as string;
    const contactId = (contact as Record<string, unknown>).id as string;
    const pipelineId = (pipeline as Record<string, unknown>).id as string;
    const stageId = (firstStage as Record<string, unknown>).id as string;
    const titulo = necessidade ? `Oportunidade - ${contactName} - ${necessidade}` : `Oportunidade - ${contactName}`;

    const { data: newDeal } = await supabase.from('deals').insert({
      contact_id: contactId, pipeline_id: pipelineId, stage_id: stageId,
      titulo: titulo.substring(0, 200), valor: valorMencionado ?? 0, temperatura, status: 'ABERTO', posicao_kanban: 0, moeda: 'BRL',
    }).select('id').single();

    if (newDeal) {
      const dealId = (newDeal as Record<string, unknown>).id as string;
      await supabase.from('deal_activities').insert({ deal_id: dealId, tipo: 'CRIACAO', descricao: 'Deal criado automaticamente pela SDR IA', metadata: { origem: 'SDR_IA', lead_id: leadId } });
      log.info('Deal criado', { dealId });
    }
  } catch (err) { log.error('AutoDeal Error', { error: err instanceof Error ? err.message : String(err) }); }
}

// ========================================
// SEND AUTO RESPONSE
// ========================================

async function sendAutoResponse(telefone: string, empresa: string, resposta: string, leadId: string | null, runId: string | null): Promise<boolean> {
  const supabaseUrl = envConfig.SUPABASE_URL;
  const serviceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: telefone, message: resposta, empresa, leadId, runId, isAutoResponse: true }),
    });
    return resp.ok;
  } catch { return false; }
}

// ========================================
// SYNC WITH PIPEDRIVE (background)
// ========================================

async function syncWithPipedrive(pipedriveDealeId: string, empresa: string, intent: string, acao: string, acaoAplicada: boolean, historico: Array<Record<string, unknown>>, mensagemAtual: string, classificacao: Record<string, unknown> | null) {
  const supabaseUrl = envConfig.SUPABASE_URL;
  const anonKey = envConfig.SUPABASE_ANON_KEY;
  try {
    const messages = [...historico.slice(0, 5).map((h) => ({ direcao: h.direcao, conteudo: (h.conteudo as string)?.substring(0, 200), created_at: h.created_at })), { direcao: 'INBOUND', conteudo: mensagemAtual.substring(0, 500), created_at: new Date().toISOString() }];
    await fetch(`${supabaseUrl}/functions/v1/pipedrive-sync`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'log_conversation', deal_id: pipedriveDealeId, empresa, data: { messages, intent, acao_aplicada: acaoAplicada ? acao : undefined, classification: classificacao ? { icp: classificacao.icp, temperatura: classificacao.temperatura, prioridade: classificacao.prioridade } : undefined } }),
    });
    if (acao === 'CRIAR_TAREFA_CLOSER' && acaoAplicada) {
      await fetch(`${supabaseUrl}/functions/v1/pipedrive-sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_activity', deal_id: pipedriveDealeId, empresa, data: { activity_type: 'call', subject: `[SDR IA] Lead qualificado - ${intent}`, note: `Intent: ${intent}. Lead qualificado via frameworks.` } }),
      });
    }
  } catch (e) { log.error('Pipedrive sync error', { error: e instanceof Error ? e.message : String(e) }); }
}

// ========================================
// AMELIA SEQUENCE MATCHING
// ========================================

async function checkAmeliaSequences(supabase: SupabaseClient, leadId: string, empresa: string, intent: string) {
  try {
    const { data: sequences } = await supabase.from('amelia_learnings').select('id, titulo, descricao, sequencia_eventos, sequencia_match_pct, tipo')
      .eq('empresa', empresa).in('tipo', ['SEQUENCIA_PERDA', 'SEQUENCIA_CHURN']).eq('status', 'VALIDADO').not('sequencia_eventos', 'is', null).limit(20);
    if (!sequences?.length) return;

    const { data: recentIntents } = await supabase.from('lead_message_intents').select('intent').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(10);
    const recentList = (recentIntents || []).map((i: { intent: string }) => i.intent).reverse();
    recentList.push(intent);

    for (const seq of sequences) {
      const seqEvents = seq.sequencia_eventos as string[];
      if (!seqEvents || seqEvents.length < 2) continue;
      let matched = 0;
      for (const ev of seqEvents) { if (recentList.includes(ev)) matched++; }
      if (matched / seqEvents.length >= 0.5) {
        const { data: contact } = await supabase.from('contacts').select('owner_id, nome').eq('legacy_lead_id', leadId).limit(1).maybeSingle();
        if (contact?.owner_id) {
          await supabase.from('notifications').insert({
            user_id: contact.owner_id, empresa, tipo: 'AMELIA_SEQUENCIA',
            titulo: `⛓️ Padrão de risco: ${contact.nome || 'Lead'}`,
            mensagem: `${matched}/${seqEvents.length} eventos de "${seq.titulo}" detectados.`,
            link: `/leads/${leadId}`, entity_id: leadId, entity_type: 'lead',
          });
        }
        break;
      }
    }
  } catch (e) { log.error('AMELIA-SEQ Error', { error: e instanceof Error ? e.message : String(e) }); }
}

// ========================================
// MAIN HANDLER
// ========================================

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const {
      lead_id, empresa, message, source, acao_recomendada, intent, temperatura, confidence,
      contato, deals, urgencia, historico, classificacao, conversation_state, pessoaContext,
      resposta_texto, pipedriveDealeId, aiResponse, tokensUsados, tempoMs, modeloUsado,
      framework_updates, novo_estado_funil, disc_estimado, ultima_pergunta_id,
    } = body;

    const actionsExecuted: string[] = [];
    const run_id = message?.run_id || null;

    // 1. Apply action
    const acaoAplicada = await applyAction(supabase, run_id, lead_id, empresa, acao_recomendada, aiResponse?.acao_detalhes, message?.conteudo);
    if (acaoAplicada) actionsExecuted.push(`Ação aplicada: ${acao_recomendada}`);

    // 2. Send auto response
    let respostaEnviada = false;
    if (resposta_texto && resposta_texto.length >= 10) {
      if (source === 'BLUECHAT') {
        // BluChat responses are returned via HTTP, not sent via WhatsApp
        respostaEnviada = false;
      } else if (contato?.telefone_e164 || contato?.telefone) {
        const telefone = contato.telefone_e164 || contato.telefone;
        respostaEnviada = await sendAutoResponse(telefone, empresa, resposta_texto, lead_id, run_id);
        if (respostaEnviada) actionsExecuted.push('Resposta enviada via WhatsApp');
      }
    }

    // 3. Save interpretation
    if (message?.id && intent) {
      const record = {
        message_id: message.id,
        lead_id,
        run_id,
        empresa,
        intent,
        intent_confidence: confidence,
        intent_summary: aiResponse?.summary || null,
        acao_recomendada,
        acao_aplicada: acaoAplicada,
        acao_detalhes: aiResponse?.acao_detalhes || null,
        modelo_ia: modeloUsado || 'unknown',
        tokens_usados: tokensUsados || 0,
        tempo_processamento_ms: tempoMs || 0,
        resposta_automatica_texto: resposta_texto,
        resposta_enviada_em: respostaEnviada ? new Date().toISOString() : null,
        sentimento: aiResponse?.sentimento || null,
      };
      const { data: intentData } = await supabase.from('lead_message_intents').insert(record).select('id').single();
      if (intentData) actionsExecuted.push(`Intent salvo: ${(intentData as Record<string, unknown>).id}`);
    }

    // 4a. Apply classification upgrade (from sdr-intent-classifier)
    if (body.classification_upgrade && lead_id) {
      const upgrade = body.classification_upgrade;
      const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (upgrade.prioridade != null) updateFields.prioridade = upgrade.prioridade;
      if (upgrade.icp) updateFields.icp = upgrade.icp;
      if (upgrade.score_interno != null) updateFields.score_interno = upgrade.score_interno;

      if (Object.keys(updateFields).length > 1) {
        const { error } = await supabase.from('lead_classifications')
          .update(updateFields)
          .eq('lead_id', lead_id)
          .eq('empresa', empresa)
          .neq('origem', 'MANUAL');
        if (!error) actionsExecuted.push(`Classification upgrade: P${upgrade.prioridade || '?'} ICP=${upgrade.icp || '?'} Score=${upgrade.score_interno || '?'}`);
        else log.error('ClassUpgrade Error', { error: error.message });
      }
    }

    // 4b. Update conversation state
    if (lead_id && (novo_estado_funil || framework_updates || disc_estimado)) {
      const validEstados = ['SAUDACAO', 'DIAGNOSTICO', 'QUALIFICACAO', 'OBJECOES', 'FECHAMENTO', 'POS_VENDA'];
      const stateUpdates: Record<string, unknown> = {};
      
      if (novo_estado_funil) {
        const upper = novo_estado_funil.toUpperCase();
        if (validEstados.includes(upper)) stateUpdates.estado_funil = upper;
        else if (['TRANSFERIDO', 'ESCALACAO_HUMANA', 'HANDOFF'].some((s: string) => upper.includes(s))) stateUpdates.estado_funil = 'FECHAMENTO';
      }
      
      if (framework_updates) {
        const normalize = (obj: unknown): Record<string, unknown> => {
          if (!obj || typeof obj !== 'object') return {};
          const r: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(obj as Record<string, unknown>)) r[k.toLowerCase()] = v;
          return r;
        };
        const existing = conversation_state?.framework_data || {};
        stateUpdates.framework_data = {
          gpct: { ...(normalize(existing.gpct || existing.GPCT)), ...(normalize(framework_updates.gpct || framework_updates.GPCT)) },
          bant: { ...(normalize(existing.bant || existing.BANT)), ...(normalize(framework_updates.bant || framework_updates.BANT)) },
          spin: { ...(normalize(existing.spin || existing.SPIN)), ...(normalize(framework_updates.spin || framework_updates.SPIN)) },
        };
      }
      
      if (disc_estimado && !conversation_state?.perfil_disc) {
        const validDisc = ['D', 'I', 'S', 'C'];
        if (validDisc.includes(disc_estimado)) stateUpdates.perfil_disc = disc_estimado;
      }
      
      if (ultima_pergunta_id) stateUpdates.ultima_pergunta_id = ultima_pergunta_id;
      
      if (Object.keys(stateUpdates).length > 0) {
        await supabase.from('lead_conversation_state').upsert({
          lead_id, empresa, canal: 'WHATSAPP', ...stateUpdates,
          ultimo_contato_em: new Date().toISOString(), updated_at: new Date().toISOString(),
        }, { onConflict: 'lead_id,empresa' });
        actionsExecuted.push('Estado conversa atualizado');
      }
    }

    // 5. Update pessoa DISC
    if (disc_estimado && pessoaContext?.pessoa?.id && !pessoaContext.pessoa.perfil_disc) {
      const { data: pessoa } = await supabase.from('pessoas').select('perfil_disc').eq('id', pessoaContext.pessoa.id).single();
      if (pessoa && !pessoa.perfil_disc) {
        await supabase.from('pessoas').update({ perfil_disc: disc_estimado, updated_at: new Date().toISOString() }).eq('id', pessoaContext.pessoa.id);
        actionsExecuted.push('DISC atualizado em pessoas');
      }
    }

    // 6. Log AI usage
    try {
      await supabase.from('ai_usage_log').insert({
        function_name: 'sdr-ia-interpret',
        provider: modeloUsado?.includes('claude') ? 'CLAUDE' : modeloUsado?.includes('gemini') ? 'GEMINI' : modeloUsado?.includes('gpt') ? 'OPENAI' : 'UNKNOWN',
        model: modeloUsado || 'unknown',
        tokens_input: null, tokens_output: null,
        success: true, latency_ms: tempoMs || 0, custo_estimado: 0, empresa: empresa || null,
      });
    } catch { /* ignore */ }

    // 7. Sync Pipedrive (background)
    if (pipedriveDealeId) {
      syncWithPipedrive(pipedriveDealeId, empresa, intent, acao_recomendada, acaoAplicada, historico || [], message?.conteudo || '', classificacao).catch((e: unknown) => log.error('Pipedrive bg error', { error: e instanceof Error ? e.message : String(e) }));
    }

    // 8. Amelia sequence matching
    if (lead_id && intent) {
      checkAmeliaSequences(supabase, lead_id, empresa, intent).catch((e: unknown) => log.error('SEQ bg error', { error: e instanceof Error ? e.message : String(e) }));
    }

    // Determine escalation
    const needsEscalation = acao_recomendada === 'ESCALAR_HUMANO' || acao_recomendada === 'CRIAR_TAREFA_CLOSER';

    return new Response(JSON.stringify({
      success: true,
      actions_executed: actionsExecuted,
      acaoAplicada,
      respostaEnviada,
      responseText: resposta_texto,
      escalation: {
        needed: needsEscalation,
        reason: needsEscalation ? (acao_recomendada === 'CRIAR_TAREFA_CLOSER' ? 'Lead qualificado' : 'Escalado para humano') : undefined,
        priority: needsEscalation ? 'HIGH' : undefined,
      },
      departamento_destino: aiResponse?.departamento_destino || (needsEscalation ? 'Comercial' : null),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log.error('Error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
