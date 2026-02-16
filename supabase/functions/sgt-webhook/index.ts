// ========================================
// sgt-webhook/index.ts — Orquestrador principal
// Fase D: Decomposição em módulos
// ========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/config.ts";
import { getWebhookCorsHeaders } from "../_shared/cors.ts";
import type { TipoLead } from "../_shared/types.ts";
import { resolveTargetPipeline, findExistingDealForPerson } from "../_shared/pipeline-routing.ts";
import { checkWebhookRateLimit, rateLimitResponse, simpleHash } from "../_shared/webhook-rate-limit.ts";

import type { SGTPayload, LeadClassificationResult } from "./types.ts";
import { validateWebhookToken } from "./auth.ts";
import { validatePayload, generateIdempotencyKey } from "./validation.ts";
import { normalizeSGTEvent, sanitizeLeadContact, upsertPessoaFromContact } from "./normalization.ts";
import { classificarLead } from "./classification.ts";
import { decidirCadenciaParaLead, iniciarCadenciaParaLead } from "./cadence.ts";

const corsHeaders = getWebhookCorsHeaders("x-sgt-signature, x-sgt-timestamp, x-webhook-secret");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createServiceClient();

  try {
    const bodyText = await req.text();
    
    console.log('[SGT Webhook] Requisição recebida:', {
      hasWebhookSecret: !!req.headers.get('x-webhook-secret'),
      hasAuth: !!req.headers.get('authorization'),
      bodyLength: bodyText.length,
    });

    const isValidToken = validateWebhookToken(req);
    if (!isValidToken) {
      console.error('[SGT Webhook] Token inválido ou ausente');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting (120 req/min per token)
    const tokenId = simpleHash(req.headers.get('x-webhook-secret') || req.headers.get('authorization') || 'unknown');
    const rateCheck = await checkWebhookRateLimit(supabase, 'sgt-webhook', tokenId, 120);
    if (!rateCheck.allowed) {
      console.warn('[SGT Webhook] Rate limit exceeded:', rateCheck.currentCount);
      return rateLimitResponse(corsHeaders);
    }

    let payload: SGTPayload;
    try {
      const rawPayload = JSON.parse(bodyText);
      const validation = validatePayload(rawPayload);
      if (!validation.valid) {
        console.error('[SGT Webhook] Payload inválido:', validation.error);
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      payload = validation.normalized as unknown as SGTPayload;
    } catch {
      return new Response(
        JSON.stringify({ error: 'JSON inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const idempotencyKey = generateIdempotencyKey(payload);
    
    const { data: existingEvent } = await supabase
      .from('sgt_events')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingEvent) {
      console.log('[SGT Webhook] Evento duplicado ignorado:', idempotencyKey);
      return new Response(
        JSON.stringify({ 
          success: true, message: 'Evento já processado',
          event_id: existingEvent.id, idempotent: true 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: newEvent, error: insertError } = await supabase
      .from('sgt_events')
      .insert({
        lead_id: payload.lead_id, empresa: payload.empresa,
        evento: payload.evento, payload: payload,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[SGT Webhook] Erro ao inserir evento:', insertError);
      throw insertError;
    }

    console.log('[SGT Webhook] Evento inserido:', newEvent.id);

    await supabase.from('sgt_event_logs').insert({
      event_id: newEvent.id, status: 'RECEBIDO',
      mensagem: `Evento ${payload.evento} recebido para lead ${payload.lead_id}`,
    } as Record<string, unknown>);

    const leadNormalizado = normalizeSGTEvent(payload);
    console.log('[SGT Webhook] Lead normalizado:', leadNormalizado);

    // Upsert em lead_contacts
    const primeiroNome = leadNormalizado.nome.split(' ')[0] || leadNormalizado.nome;
    const payloadAny = payload as unknown as Record<string, unknown>;
    const pipedriveDealeId = 
      payload.dados_lead?.pipedrive_deal_id || 
      payloadAny.pipedrive_deal_id ||
      null;
    
    const leadContactUpsert: Record<string, unknown> = {
      lead_id: payload.lead_id, empresa: payload.empresa,
      nome: leadNormalizado.nome, email: leadNormalizado.email,
      telefone: leadNormalizado.telefone, primeiro_nome: primeiroNome,
      pipedrive_deal_id: pipedriveDealeId,
    };

    if (payload.score_temperatura !== undefined) {
      leadContactUpsert.score_marketing = payload.score_temperatura;
    }
    if (payload.prioridade) {
      leadContactUpsert.prioridade_marketing = payload.prioridade;
    }

    // LinkedIn
    if (payload.dados_linkedin) {
      if (payload.dados_linkedin.url) leadContactUpsert.linkedin_url = payload.dados_linkedin.url;
      if (payload.dados_linkedin.cargo) leadContactUpsert.linkedin_cargo = payload.dados_linkedin.cargo;
      if (payload.dados_linkedin.empresa) leadContactUpsert.linkedin_empresa = payload.dados_linkedin.empresa;
      if (payload.dados_linkedin.setor) leadContactUpsert.linkedin_setor = payload.dados_linkedin.setor;
      if (payload.dados_linkedin.senioridade) leadContactUpsert.linkedin_senioridade = payload.dados_linkedin.senioridade;
      if (payload.dados_linkedin.conexoes !== undefined) leadContactUpsert.linkedin_conexoes = payload.dados_linkedin.conexoes;
    }

    // Mautic extras
    if (payload.dados_mautic) {
      if (payload.dados_mautic.first_visit) leadContactUpsert.mautic_first_visit = payload.dados_mautic.first_visit;
      if (payload.dados_mautic.cidade) leadContactUpsert.mautic_cidade = payload.dados_mautic.cidade;
      if (payload.dados_mautic.estado) leadContactUpsert.mautic_estado = payload.dados_mautic.estado;
    }

    // Chatwoot extras
    if (payload.dados_chatwoot) {
      if (payload.dados_chatwoot.conversas_total !== undefined) leadContactUpsert.chatwoot_conversas_total = payload.dados_chatwoot.conversas_total;
      if (payload.dados_chatwoot.tempo_resposta_medio !== undefined) leadContactUpsert.chatwoot_tempo_resposta_medio = payload.dados_chatwoot.tempo_resposta_medio;
      if (payload.dados_chatwoot.agente_atual) leadContactUpsert.chatwoot_agente_atual = payload.dados_chatwoot.agente_atual;
      if (payload.dados_chatwoot.inbox) leadContactUpsert.chatwoot_inbox = payload.dados_chatwoot.inbox;
      if (payload.dados_chatwoot.status_atendimento) leadContactUpsert.chatwoot_status_atendimento = payload.dados_chatwoot.status_atendimento;
    }

    await supabase.from('lead_contacts').upsert(leadContactUpsert, { onConflict: 'lead_id,empresa' });
    console.log('[SGT Webhook] Lead contact upserted com dados enriquecidos:', payload.lead_id);

    // Sanitização
    const sanitization = sanitizeLeadContact({
      telefone: leadNormalizado.telefone, email: leadNormalizado.email, empresa: payload.empresa
    });
    console.log('[SGT Webhook] Sanitização:', {
      leadId: payload.lead_id, phoneInfo: sanitization.phoneInfo,
      emailPlaceholder: sanitization.emailPlaceholder,
      issuesCount: sanitization.issues.length, descartarLead: sanitization.descartarLead
    });

    const updateData: Record<string, unknown> = {
      telefone_valido: !!sanitization.phoneInfo,
      telefone_validado_em: new Date().toISOString(),
      email_placeholder: sanitization.emailPlaceholder
    };
    
    if (sanitization.phoneInfo) {
      updateData.telefone_e164 = sanitization.phoneInfo.e164;
      updateData.ddi = sanitization.phoneInfo.ddi;
      updateData.numero_nacional = sanitization.phoneInfo.nacional;
      updateData.contato_internacional = sanitization.phoneInfo.internacional;
      updateData.origem_telefone = 'SGT';
    }

    // Pessoa global
    const pessoaId = await upsertPessoaFromContact(supabase, {
      nome: leadNormalizado.nome, email: leadNormalizado.email,
      telefone: leadNormalizado.telefone, telefone_e164: sanitization.phoneInfo?.e164
    });
    
    if (pessoaId) {
      updateData.pessoa_id = pessoaId;
      console.log('[SGT Webhook] Lead vinculado à pessoa global:', pessoaId);
    }
    
    await supabase.from('lead_contacts').update(updateData)
      .eq('lead_id', payload.lead_id).eq('empresa', payload.empresa);

    // AUTO-CRIAÇÃO / MERGE DE CONTATO CRM
    if (pessoaId) {
      try {
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id, nome, email, telefone')
          .eq('pessoa_id', pessoaId)
          .eq('empresa', payload.empresa)
          .maybeSingle();

        if (!existingContact) {
          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              pessoa_id: pessoaId, empresa: payload.empresa,
              nome: leadNormalizado.nome, primeiro_nome: primeiroNome,
              email: leadNormalizado.email || null,
              telefone: sanitization.phoneInfo?.e164 || leadNormalizado.telefone || null,
              canal_origem: 'SGT', tipo: 'LEAD',
              tags: ['sgt-inbound'], legacy_lead_id: payload.lead_id,
              is_active: true, is_cliente: false,
            })
            .select('id').single();

          if (contactError) console.error('[SGT Webhook] Erro ao criar contact CRM:', contactError);
          else console.log('[SGT Webhook] Contact CRM criado:', newContact.id);
        } else {
          const mergeData: Record<string, unknown> = {};
          if (!existingContact.email && leadNormalizado.email) mergeData.email = leadNormalizado.email;
          if (!existingContact.telefone && (sanitization.phoneInfo?.e164 || leadNormalizado.telefone)) {
            mergeData.telefone = sanitization.phoneInfo?.e164 || leadNormalizado.telefone;
          }
          if (Object.keys(mergeData).length > 0) {
            mergeData.updated_at = new Date().toISOString();
            await supabase.from('contacts').update(mergeData).eq('id', existingContact.id);
            console.log('[SGT Webhook] Contact CRM atualizado (merge):', existingContact.id, Object.keys(mergeData));
          } else {
            console.log('[SGT Webhook] Contact CRM já existe, sem campos para merge:', existingContact.id);
          }
        }
      } catch (contactErr) {
        console.error('[SGT Webhook] Erro no fluxo de contacts:', contactErr);
      }
    }

    // Registrar issues de contato
    if (sanitization.issues.length > 0) {
      for (const issue of sanitization.issues) {
        const { data: existingIssue } = await supabase
          .from('lead_contact_issues').select('id')
          .eq('lead_id', payload.lead_id).eq('empresa', payload.empresa)
          .eq('issue_tipo', issue.tipo).eq('resolvido', false)
          .maybeSingle();
        
        if (!existingIssue) {
          await supabase.from('lead_contact_issues').insert({
            lead_id: payload.lead_id, empresa: payload.empresa,
            issue_tipo: issue.tipo, severidade: issue.severidade, mensagem: issue.mensagem
          });
          console.log('[SGT Webhook] Issue de contato registrada:', issue.tipo);
        } else {
          console.log('[SGT Webhook] Issue já existe, ignorando duplicata:', issue.tipo);
        }
      }
    }

    // Se lead deve ser descartado
    if (sanitization.descartarLead) {
      console.log('[SGT Webhook] Lead descartado - deletando dados:', payload.lead_id);
      
      await supabase.from('lead_message_intents').delete().eq('lead_id', payload.lead_id);
      await supabase.from('lead_messages').delete().eq('lead_id', payload.lead_id);
      await supabase.from('lead_conversation_state').delete().eq('lead_id', payload.lead_id).eq('empresa', payload.empresa);
      await supabase.from('lead_classifications').delete().eq('lead_id', payload.lead_id).eq('empresa', payload.empresa);
      await supabase.from('lead_cadence_events').delete().in('lead_cadence_run_id', 
        (await supabase.from('lead_cadence_runs').select('id').eq('lead_id', payload.lead_id).eq('empresa', payload.empresa)).data?.map(r => r.id) || []
      );
      await supabase.from('lead_cadence_runs').delete().eq('lead_id', payload.lead_id).eq('empresa', payload.empresa);
      await supabase.from('lead_contacts').delete().eq('lead_id', payload.lead_id).eq('empresa', payload.empresa);
      
      await supabase.from('sgt_events').update({ processado_em: new Date().toISOString() }).eq('id', newEvent.id);
      
      return new Response(
        JSON.stringify({
          success: true, event_id: newEvent.id, lead_id: payload.lead_id,
          evento: payload.evento, empresa: payload.empresa,
          discarded: true, deleted: true, reason: 'LEAD_SEM_CANAL_CONTATO_VALIDO',
          issues: sanitization.issues.map(i => i.mensagem)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // VERIFICAR MODO DE ATENDIMENTO
    const { data: convState } = await supabase
      .from('lead_conversation_state')
      .select('id, modo')
      .eq('lead_id', payload.lead_id)
      .eq('empresa', payload.empresa)
      .maybeSingle();

    if (convState?.modo === 'MANUAL') {
      console.log('[SGT Webhook] Lead em modo MANUAL, apenas enriquecendo dados');
      
      await supabase.from('sgt_event_logs').insert({
        event_id: newEvent.id, status: 'PROCESSADO',
        mensagem: 'Lead em atendimento manual - dados enriquecidos sem iniciar automação'
      } as Record<string, unknown>);
      
      await supabase.from('sgt_events').update({ processado_em: new Date().toISOString() }).eq('id', newEvent.id);

      return new Response(
        JSON.stringify({
          success: true, event_id: newEvent.id, lead_id: payload.lead_id,
          evento: payload.evento, empresa: payload.empresa,
          enriched_only: true, reason: 'LEAD_EM_ATENDIMENTO_MANUAL',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar estado conversacional se não existe
    if (!convState) {
      console.log('[SGT Webhook] Criando conversation_state para lead:', payload.lead_id);
      const defaultFramework = payload.empresa === 'TOKENIZA' ? 'GPCT' : 'SPIN';
      
      await supabase.from('lead_conversation_state').insert({
        lead_id: payload.lead_id, empresa: payload.empresa,
        canal: 'WHATSAPP', estado_funil: 'SAUDACAO',
        framework_ativo: defaultFramework, modo: 'SDR_IA',
        idioma_preferido: 'PT', ultimo_contato_em: new Date().toISOString(),
      } as Record<string, unknown>);
    }

    let classification: LeadClassificationResult | null = null;
    let cadenceResult: { cadenceCodigo: string | null; runId?: string; skipped?: boolean } = { cadenceCodigo: null };

    try {
      classification = await classificarLead(supabase, newEvent.id, leadNormalizado);
      
      // AUTO-CRIAÇÃO DE DEAL
      try {
        const { data: contactForDeal } = await supabase
          .from('contacts')
          .select('id, telefone_e164, email, cpf')
          .eq('legacy_lead_id', payload.lead_id)
          .eq('empresa', payload.empresa)
          .maybeSingle();

        if (contactForDeal) {
          const tipoLead: TipoLead = (payload.dados_lead as Record<string, unknown>)?.tipo_lead as TipoLead || (payload as Record<string, unknown>).tipo_lead as TipoLead || 'INVESTIDOR';
          const temperatura = classification?.temperatura || 'FRIO';
          const isPriority = 
            payload.dados_lead.stage === 'Atacar agora!' ||
            !!payload.dados_lead.data_levantou_mao ||
            payload.prioridade === 'URGENTE';

          const duplicateMatch = await findExistingDealForPerson(supabase, payload.empresa, {
            telefone_e164: contactForDeal.telefone_e164,
            telefone: leadNormalizado.telefone,
            email: leadNormalizado.email,
            cpf: contactForDeal.cpf,
          });

          if (duplicateMatch) {
            console.log('[SGT Webhook] Duplicata detectada:', duplicateMatch);
            const enrichUpdates: Record<string, unknown> = {};
            if (leadNormalizado.email && !contactForDeal.email) enrichUpdates.email = leadNormalizado.email;
            if (Object.keys(enrichUpdates).length > 0) {
              await supabase.from('contacts').update(enrichUpdates).eq('id', duplicateMatch.contactId);
              console.log('[SGT Webhook] Contact enriquecido:', enrichUpdates);
            }
            await supabase.from('sgt_event_logs').insert({
              event_id: newEvent.id, status: 'PROCESSADO',
              mensagem: `Duplicata detectada: deal ${duplicateMatch.dealId} já existe para contact ${duplicateMatch.contactId}`,
            } as Record<string, unknown>);
          } else {
            const routing = resolveTargetPipeline(payload.empresa, tipoLead, temperatura, isPriority);
            console.log('[SGT Webhook] Roteamento:', { ...routing, empresa: payload.empresa, tipoLead, temperatura, isPriority });

            const dealTitulo = `${leadNormalizado.nome} — Inbound SGT`;
            const { data: newDeal, error: dealError } = await supabase
              .from('deals')
              .insert({
                contact_id: contactForDeal.id, pipeline_id: routing.pipelineId,
                stage_id: routing.stageId, titulo: dealTitulo,
                valor: 0, moeda: 'BRL', temperatura,
                status: 'ABERTO', origem: 'SGT',
                utm_source: leadNormalizado.utm_source, utm_medium: leadNormalizado.utm_medium,
                utm_campaign: leadNormalizado.utm_campaign, utm_content: leadNormalizado.utm_content,
                utm_term: leadNormalizado.utm_term,
              } as Record<string, unknown>)
              .select('id').single();

            if (dealError) {
              console.error('[SGT Webhook] Erro ao criar deal:', dealError);
            } else {
              console.log('[SGT Webhook] Deal criado:', newDeal.id, '| Pipeline:', routing.pipelineId, '| Temp:', temperatura);

              await supabase.from('deal_activities').insert({
                deal_id: newDeal.id, tipo: 'CRIACAO',
                descricao: `Deal criado via SGT (${isPriority ? 'PRIORIDADE' : temperatura}) → ${payload.empresa}${tipoLead !== 'INVESTIDOR' ? ` [${tipoLead}]` : ''}`,
                metadata: {
                  origem: 'SGT', temperatura, is_priority: isPriority,
                  lead_id: payload.lead_id, evento: payload.evento,
                  tipo_lead: tipoLead, pipeline_id: routing.pipelineId,
                },
              } as Record<string, unknown>);

              if (isPriority || temperatura === 'QUENTE') {
                const { data: adminRoles } = await supabase
                  .from('user_roles').select('user_id')
                  .in('role', ['ADMIN', 'CLOSER']).limit(10);
                for (const admin of adminRoles ?? []) {
                  await supabase.from('notifications').insert({
                    user_id: admin.user_id,
                    tipo: 'DEAL_NOVO_PRIORITARIO',
                    titulo: isPriority ? '🔥 Lead pediu atendimento urgente!' : '🔥 Lead QUENTE entrou no pipeline!',
                    mensagem: `${leadNormalizado.nome} — ${payload.empresa}`,
                    empresa: payload.empresa,
                    link: `/pipeline?deal=${newDeal.id}`,
                    entity_id: newDeal.id, entity_type: 'deal',
                    metadata: { deal_id: newDeal.id, temperatura, lead_id: payload.lead_id },
                  } as Record<string, unknown>);
                }
              }

              if (temperatura === 'FRIO' && convState?.modo !== 'MANUAL') {
                const warmingCode = payload.empresa === 'BLUE' 
                  ? 'WARMING_INBOUND_FRIO_BLUE' 
                  : 'WARMING_INBOUND_FRIO_TOKENIZA';
                const { data: warmingCadence } = await supabase
                  .from('cadences').select('id').eq('codigo', warmingCode).eq('ativo', true).maybeSingle();
                if (warmingCadence) {
                  const { data: warmingRun } = await supabase
                    .from('lead_cadence_runs')
                    .insert({
                      cadence_id: warmingCadence.id, lead_id: payload.lead_id,
                      empresa: payload.empresa, status: 'ATIVA',
                      last_step_ordem: 0, next_step_ordem: 1,
                      next_run_at: new Date().toISOString(),
                    } as Record<string, unknown>)
                    .select('id').single();
                  if (warmingRun) {
                    await supabase.from('deal_cadence_runs').insert({
                      deal_id: newDeal.id, cadence_run_id: warmingRun.id,
                      trigger_stage_id: routing.stageId, trigger_type: 'AUTO_WARMING', status: 'ACTIVE',
                    } as Record<string, unknown>);
                    console.log('[SGT Webhook] Cadência de aquecimento iniciada:', warmingRun.id);
                  }
                }
              }
            }
          }
        }
      } catch (dealErr) {
        console.error('[SGT Webhook] Erro no fluxo de auto-criação de deal:', dealErr);
      }

      const cadenceCodigo = decidirCadenciaParaLead(classification, payload.evento);
      cadenceResult.cadenceCodigo = cadenceCodigo;

      if (cadenceCodigo) {
        const result = await iniciarCadenciaParaLead(
          supabase, payload.lead_id, payload.empresa,
          cadenceCodigo, classification, newEvent.id
        );
        cadenceResult.runId = result.runId;
        cadenceResult.skipped = result.skipped;

        if (!result.success && !result.skipped) {
          console.warn('[SGT Webhook] Falha ao iniciar cadência:', result.reason);
        }
      }

      await supabase.from('sgt_events').update({ processado_em: new Date().toISOString() }).eq('id', newEvent.id);

    } catch (pipelineError) {
      console.error('[SGT Webhook] Erro no pipeline:', pipelineError);
      
      await supabase.from('sgt_event_logs').insert({
        event_id: newEvent.id, status: 'ERRO',
        mensagem: 'Erro no pipeline de classificação/cadência',
        erro_stack: pipelineError instanceof Error ? pipelineError.stack : String(pipelineError),
      } as Record<string, unknown>);
    }

    return new Response(
      JSON.stringify({
        success: true, event_id: newEvent.id,
        lead_id: payload.lead_id, evento: payload.evento, empresa: payload.empresa,
        classification: classification ? {
          icp: classification.icp, persona: classification.persona,
          temperatura: classification.temperatura, prioridade: classification.prioridade,
          score_interno: classification.scoreInterno,
        } : null,
        cadence: cadenceResult.cadenceCodigo ? {
          codigo: cadenceResult.cadenceCodigo, run_id: cadenceResult.runId,
          skipped: cadenceResult.skipped || false,
        } : null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SGT Webhook] Erro geral:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
