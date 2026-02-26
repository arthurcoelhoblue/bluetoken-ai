// ========================================
// ACTION EXECUTOR MODULE — Extracted from sdr-action-executor Edge Function
// Applies SDR actions: cadence control, opt-out, escalation, deal creation, WhatsApp send
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envConfig } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger('sdr-action-executor');

// ========================================
// APPLY ACTION
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
        try {
          await fetch(`${envConfig.SUPABASE_URL}/functions/v1/notify-closer`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_id: leadId, empresa, motivo: (detalhes as Record<string, unknown> | undefined)?.motivo || 'Lead qualificado pelo SDR IA' }),
          });
        } catch { /* ignore */ }
        await supabase.from('lead_conversation_state').update({ modo: 'MANUAL', updated_at: now }).eq('lead_id', leadId).eq('empresa', empresa);
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
// AUTO-CREATE DEAL
// ========================================

async function autoCreateDeal(supabase: SupabaseClient, leadId: string, empresa: string, detalhes?: Record<string, unknown>) {
  try {
    const { data: contact } = await supabase.from('contacts').select('id, nome').eq('legacy_lead_id', leadId).maybeSingle();
    if (!contact) return;

    const { data: pipeline } = await supabase.from('pipelines').select('id').eq('empresa', empresa).eq('is_default', true).eq('ativo', true).maybeSingle();
    if (!pipeline) return;

    const contactId = (contact as Record<string, unknown>).id as string;
    const pipelineId = (pipeline as Record<string, unknown>).id as string;

    const { data: existingDeal } = await supabase.from('deals').select('id').eq('contact_id', contactId).eq('pipeline_id', pipelineId).eq('status', 'ABERTO').maybeSingle();
    if (existingDeal) return;

    const { data: firstStage } = await supabase.from('pipeline_stages').select('id').eq('pipeline_id', pipelineId).eq('is_won', false).eq('is_lost', false).order('posicao', { ascending: true }).limit(1).maybeSingle();
    if (!firstStage) return;

    const valorMencionado = (detalhes as Record<string, unknown> | undefined)?.valor_mencionado as number | undefined;
    const necessidade = (detalhes as Record<string, unknown> | undefined)?.necessidade_principal as string | undefined;
    const contactName = (contact as Record<string, unknown>).nome as string;
    const stageId = (firstStage as Record<string, unknown>).id as string;
    const titulo = necessidade ? `Oportunidade - ${contactName} - ${necessidade}` : `Oportunidade - ${contactName}`;

    const { data: newDeal } = await supabase.from('deals').insert({
      contact_id: contactId, pipeline_id: pipelineId, stage_id: stageId,
      titulo: titulo.substring(0, 200), valor: valorMencionado ?? 0, temperatura: 'QUENTE', status: 'ABERTO', posicao_kanban: 0, moeda: 'BRL',
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
  try {
    const resp = await fetch(`${envConfig.SUPABASE_URL}/functions/v1/whatsapp-send`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: telefone, message: resposta, empresa, leadId, runId, isAutoResponse: true }),
    });
    return resp.ok;
  } catch { return false; }
}

// ========================================
// SYNC WITH PIPEDRIVE
// ========================================

async function syncWithPipedrive(pipedriveDealeId: string, empresa: string, intent: string, acao: string, acaoAplicada: boolean, historico: Array<Record<string, unknown>>, mensagemAtual: string, classificacao: Record<string, unknown> | null) {
  try {
    const messages = [...historico.slice(0, 5).map((h) => ({ direcao: h.direcao, conteudo: (h.conteudo as string)?.substring(0, 200), created_at: h.created_at })), { direcao: 'INBOUND', conteudo: mensagemAtual.substring(0, 500), created_at: new Date().toISOString() }];
    await fetch(`${envConfig.SUPABASE_URL}/functions/v1/pipedrive-sync`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${envConfig.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'log_conversation', deal_id: pipedriveDealeId, empresa, data: { messages, intent, acao_aplicada: acaoAplicada ? acao : undefined, classification: classificacao ? { icp: classificacao.icp, temperatura: classificacao.temperatura, prioridade: classificacao.prioridade } : undefined } }),
    });
    if (acao === 'CRIAR_TAREFA_CLOSER' && acaoAplicada) {
      await fetch(`${envConfig.SUPABASE_URL}/functions/v1/pipedrive-sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${envConfig.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
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
// PUBLIC API
// ========================================

export interface ExecuteActionsParams {
  lead_id: string | null;
  run_id: string | null;
  empresa: string;
  acao: string;
  acao_detalhes?: Record<string, unknown>;
  telefone?: string | null;
  resposta?: string | null;
  source?: string;
  intent: string;
  confidence: number;
  mensagem_original: string;
  novo_estado_funil?: string;
  frameworks_atualizados?: Record<string, unknown>;
  disc_estimado?: string | null;
  ultima_pergunta_id?: string | null;
  conversation_state?: Record<string, unknown> | null;
  pessoaContext?: Record<string, unknown> | null;
  classificacao?: Record<string, unknown> | null;
  pipedriveDealeId?: string | null;
  historico?: Record<string, unknown>[];
  classification_upgrade?: Record<string, unknown>;
  _ia_null_count_update?: number;
}

export interface ExecuteActionsResult {
  acaoAplicada: boolean;
  respostaEnviada: boolean;
}

export async function executeActions(supabase: SupabaseClient, params: ExecuteActionsParams): Promise<ExecuteActionsResult> {
  const { lead_id, run_id, empresa, acao, acao_detalhes, telefone, resposta, source, intent, mensagem_original, novo_estado_funil, frameworks_atualizados, disc_estimado, ultima_pergunta_id, conversation_state, pessoaContext, classificacao, pipedriveDealeId, historico, classification_upgrade, _ia_null_count_update } = params;

  // 1. Apply action
  const acaoAplicada = await applyAction(supabase, run_id, lead_id, empresa, acao, acao_detalhes, mensagem_original);

  // 2. Send auto response
  let respostaEnviada = false;
  if (resposta && resposta.length >= 10) {
    if (telefone) {
      respostaEnviada = await sendAutoResponse(telefone, empresa, resposta, lead_id, run_id);
    }
  }

  // 2.1 Flag ja_cumprimentou — persiste no framework_data se a resposta contém apresentação
  if (resposta && lead_id && /sou a (am[eé]lia|maria|lu[íi]sa)/i.test(resposta)) {
    try {
      const { data: curState } = await supabase
        .from('lead_conversation_state')
        .select('framework_data')
        .eq('lead_id', lead_id)
        .eq('empresa', empresa)
        .maybeSingle();
      const existingFd = (curState?.framework_data as Record<string, unknown>) || {};
      if (!existingFd.ja_cumprimentou) {
        await supabase
          .from('lead_conversation_state')
          .update({
            framework_data: { ...existingFd, ja_cumprimentou: true },
            updated_at: new Date().toISOString(),
          })
          .eq('lead_id', lead_id)
          .eq('empresa', empresa);
        log.info('Flag ja_cumprimentou gravado', { lead_id });
      }
    } catch (e) {
      log.error('Erro ao gravar ja_cumprimentou', { error: e instanceof Error ? e.message : String(e) });
    }
  }

  // 3. Apply classification upgrade
  if (classification_upgrade && lead_id) {
    const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (classification_upgrade.prioridade != null) updateFields.prioridade = classification_upgrade.prioridade;
    if (classification_upgrade.icp) updateFields.icp = classification_upgrade.icp;
    if (classification_upgrade.score_interno != null) updateFields.score_interno = classification_upgrade.score_interno;

    if (Object.keys(updateFields).length > 1) {
      await supabase.from('lead_classifications')
        .update(updateFields)
        .eq('lead_id', lead_id)
        .eq('empresa', empresa)
        .neq('origem', 'MANUAL');
    }
  }

  // 4. Update conversation state (including ia_null_count)
  const hasIaNullCountUpdate = (params as Record<string, unknown>)._ia_null_count_update !== undefined;
  if (lead_id && (novo_estado_funil || frameworks_atualizados || disc_estimado || hasIaNullCountUpdate)) {
    const validEstados = ['SAUDACAO', 'DIAGNOSTICO', 'QUALIFICACAO', 'OBJECOES', 'FECHAMENTO', 'POS_VENDA'];
    const stateUpdates: Record<string, unknown> = {};

    if (novo_estado_funil) {
      const upper = novo_estado_funil.toUpperCase();
      if (validEstados.includes(upper)) stateUpdates.estado_funil = upper;
      else if (['TRANSFERIDO', 'ESCALACAO_HUMANA', 'HANDOFF'].some((s: string) => upper.includes(s))) stateUpdates.estado_funil = 'FECHAMENTO';
    }

    if (frameworks_atualizados) {
      const normalizeKey = (rawKey: string): string => rawKey
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

      const aliases: Record<'spin' | 'gpct' | 'bant', Record<string, string>> = {
        spin: {
          s: 's', situacao: 's', contexto: 's',
          p: 'p', problema: 'p', dor: 'p', dificuldade: 'p',
          i: 'i', implicacao: 'i', impacto: 'i', risco: 'i',
          n: 'n', necessidade: 'n', necessidade_solucao: 'n', need_payoff: 'n', solucao: 'n',
        },
        gpct: {
          g: 'g', goals: 'g', goal: 'g', objetivo: 'g', objetivos: 'g',
          p: 'p', plans: 'p', plan: 'p', plano: 'p',
          c: 'c', challenge: 'c', challenges: 'c', desafio: 'c', desafios: 'c',
          t: 't', timeline: 't', prazo: 't', tempo: 't',
        },
        bant: {
          b: 'b', budget: 'b', orcamento: 'b',
          a: 'a', authority: 'a', decisor: 'a',
          n: 'n', need: 'n', necessidade: 'n',
          t: 't', timing: 't', prazo: 't', tempo: 't',
        },
      };

      const normalizeFramework = (obj: unknown, framework: 'spin' | 'gpct' | 'bant'): Record<string, unknown> => {
        if (!obj || typeof obj !== 'object') return {};
        const result: Record<string, unknown> = {};
        const map = aliases[framework];
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          const canonical = map[normalizeKey(k)] || normalizeKey(k);
          result[canonical] = v;
        }
        return result;
      };

      // Remove null/undefined values to prevent overwriting real data
      const stripNulls = (obj: Record<string, unknown>): Record<string, unknown> => {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (v !== null && v !== undefined) result[k] = v;
        }
        return result;
      };

      const existing = conversation_state?.framework_data as Record<string, unknown> || {};
      const fu = frameworks_atualizados as Record<string, unknown>;
      stateUpdates.framework_data = {
        ...existing,  // preserve ia_null_count, etc.
        gpct: {
          ...normalizeFramework(existing.gpct || existing.GPCT, 'gpct'),
          ...stripNulls(normalizeFramework(fu.gpct || fu.GPCT, 'gpct')),
        },
        bant: {
          ...normalizeFramework(existing.bant || existing.BANT, 'bant'),
          ...stripNulls(normalizeFramework(fu.bant || fu.BANT, 'bant')),
        },
        spin: {
          ...normalizeFramework(existing.spin || existing.SPIN, 'spin'),
          ...stripNulls(normalizeFramework(fu.spin || fu.SPIN, 'spin')),
        },
      };
    }

    // Persist ia_null_count in framework_data
    if (_ia_null_count_update !== undefined) {
      const existing = (stateUpdates.framework_data as Record<string, unknown>) || conversation_state?.framework_data as Record<string, unknown> || {};
      stateUpdates.framework_data = { ...existing, ia_null_count: _ia_null_count_update };
    }

    if (disc_estimado && !conversation_state?.perfil_disc) {
      const validDisc = ['D', 'I', 'S', 'C'];
      if (validDisc.includes(disc_estimado)) stateUpdates.perfil_disc = disc_estimado;
    }

    if (ultima_pergunta_id) stateUpdates.ultima_pergunta_id = ultima_pergunta_id;

    if (Object.keys(stateUpdates).length > 0) {
      await supabase.from('lead_conversation_state').update({
        ...stateUpdates,
        ultimo_contato_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('lead_id', lead_id).eq('empresa', empresa);
    }
  }

  // 5. Update pessoa DISC
  if (disc_estimado && pessoaContext?.pessoa) {
    const pessoa = pessoaContext.pessoa as Record<string, unknown>;
    if (pessoa.id && !pessoa.perfil_disc) {
      const { data: pessoaRow } = await supabase.from('pessoas').select('perfil_disc').eq('id', pessoa.id).single();
      if (pessoaRow && !pessoaRow.perfil_disc) {
        await supabase.from('pessoas').update({ perfil_disc: disc_estimado, updated_at: new Date().toISOString() }).eq('id', pessoa.id);
      }
    }
  }

  // 6. Sync Pipedrive (background)
  if (pipedriveDealeId) {
    syncWithPipedrive(pipedriveDealeId, empresa, intent, acao, acaoAplicada, historico || [], mensagem_original, classificacao || null).catch((e: unknown) => log.error('Pipedrive bg error', { error: e instanceof Error ? e.message : String(e) }));
  }

  // 7. Amelia sequence matching (background)
  if (lead_id && intent) {
    checkAmeliaSequences(supabase, lead_id, empresa, intent).catch((e: unknown) => log.error('SEQ bg error', { error: e instanceof Error ? e.message : String(e) }));
  }

  return { acaoAplicada, respostaEnviada };
}
