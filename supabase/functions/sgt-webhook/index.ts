// ========================================
// sgt-webhook/index.ts — Orquestrador principal
// Fase D: Decomposição em módulos
// ========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import { getWebhookCorsHeaders } from "../_shared/cors.ts";
// (imports de pipeline-routing e cadence removidos — SGT agora é apenas enriquecimento)
import { checkWebhookRateLimit, rateLimitResponse, simpleHash } from "../_shared/webhook-rate-limit.ts";

import type { SGTPayload, LeadClassificationResult } from "./types.ts";
import { validateWebhookToken } from "./auth.ts";
import { validatePayload, generateIdempotencyKey } from "./validation.ts";
import { normalizeSGTEvent, sanitizeLeadContact, upsertPessoaFromContact } from "./normalization.ts";
import { classificarLead } from "./classification.ts";

const log = createLogger('sgt-webhook');
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
    
    log.info('Requisição recebida', {
      hasWebhookSecret: !!req.headers.get('x-webhook-secret'),
      hasAuth: !!req.headers.get('authorization'),
      bodyLength: bodyText.length,
    });

    const isValidToken = validateWebhookToken(req);
    if (!isValidToken) {
      log.error('Token inválido ou ausente');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting (120 req/min per token)
    const tokenId = simpleHash(req.headers.get('x-webhook-secret') || req.headers.get('authorization') || 'unknown');
    const rateCheck = await checkWebhookRateLimit(supabase, 'sgt-webhook', tokenId, 120);
    if (!rateCheck.allowed) {
      log.warn('Rate limit exceeded', { currentCount: rateCheck.currentCount });
      return rateLimitResponse(corsHeaders);
    }

    let payload: SGTPayload;
    try {
      const rawPayload = JSON.parse(bodyText);
      const validation = validatePayload(rawPayload);
      if (!validation.valid) {
        log.error('Payload inválido', { error: validation.error });
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
      log.info('Evento duplicado ignorado', { idempotencyKey });
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
      log.error('Erro ao inserir evento', { error: insertError.message });
      throw insertError;
    }

    log.info('Evento inserido', { eventId: newEvent.id });

    await supabase.from('sgt_event_logs').insert({
      event_id: newEvent.id, status: 'RECEBIDO',
      mensagem: `Evento ${payload.evento} recebido para lead ${payload.lead_id}`,
    } as Record<string, unknown>);

    const leadNormalizado = normalizeSGTEvent(payload);
    log.info('Lead normalizado', { leadId: payload.lead_id, nome: leadNormalizado.nome });

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
    log.info('Lead contact upserted com dados enriquecidos', { leadId: payload.lead_id });

    // Sanitização
    const sanitization = sanitizeLeadContact({
      telefone: leadNormalizado.telefone, email: leadNormalizado.email, empresa: payload.empresa
    });
    log.info('Sanitização', {
      leadId: payload.lead_id, phoneValid: !!sanitization.phoneInfo,
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
      log.info('Lead vinculado à pessoa global', { pessoaId });
    }
    
    await supabase.from('lead_contacts').update(updateData)
      .eq('lead_id', payload.lead_id).eq('empresa', payload.empresa);

    // AUTO-CRIAÇÃO / MERGE DE CONTATO CRM (usa módulo compartilhado de dedup)
    if (pessoaId) {
      try {
        // Primeiro tenta via pessoa_id (match exato global)
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id, nome, email, telefone')
          .eq('pessoa_id', pessoaId)
          .eq('empresa', payload.empresa)
          .maybeSingle();

        if (!existingContact) {
          // Fallback: dedup por email+empresa / telefone+empresa antes de criar
          const { findOrCreateContact } = await import('../_shared/contact-dedup.ts');
          try {
            const { contactId, isNew } = await findOrCreateContact(supabase, {
              leadId: payload.lead_id,
              empresa: payload.empresa,
              nome: leadNormalizado.nome,
              email: leadNormalizado.email || null,
              telefone: sanitization.phoneInfo?.e164 || leadNormalizado.telefone || null,
            });
            // Vincular pessoa_id ao contact encontrado/criado
            await supabase.from('contacts').update({
              pessoa_id: pessoaId,
              canal_origem: 'SGT',
              tags: ['sgt-inbound'],
              updated_at: new Date().toISOString(),
            }).eq('id', contactId);
            if (isNew) log.info('Contact CRM criado via dedup', { contactId });
            else log.info('Contact CRM encontrado via dedup', { contactId });
          } catch (dedupErr) {
            log.error('Erro no dedup de contacts', { error: String(dedupErr) });
          }
        } else {
          const mergeData: Record<string, unknown> = {};
          if (!existingContact.email && leadNormalizado.email) mergeData.email = leadNormalizado.email;
          if (!existingContact.telefone && (sanitization.phoneInfo?.e164 || leadNormalizado.telefone)) {
            mergeData.telefone = sanitization.phoneInfo?.e164 || leadNormalizado.telefone;
          }
          if (Object.keys(mergeData).length > 0) {
            mergeData.updated_at = new Date().toISOString();
            await supabase.from('contacts').update(mergeData).eq('id', existingContact.id);
            log.info('Contact CRM atualizado (merge)', { contactId: existingContact.id, fields: Object.keys(mergeData) });
          } else {
            log.info('Contact CRM já existe, sem campos para merge', { contactId: existingContact.id });
          }
        }
      } catch (contactErr) {
        log.error('Erro no fluxo de contacts', { error: contactErr instanceof Error ? contactErr.message : String(contactErr) });
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
          log.info('Issue de contato registrada', { tipo: issue.tipo });
        } else {
          log.info('Issue já existe, ignorando duplicata', { tipo: issue.tipo });
        }
      }
    }

    // Se lead deve ser descartado
    if (sanitization.descartarLead) {
      log.info('Lead descartado - deletando dados', { leadId: payload.lead_id });
      
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
      log.info('Lead em modo MANUAL, apenas enriquecendo dados');
      
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
      log.info('Criando conversation_state para lead', { leadId: payload.lead_id });
      const defaultFramework = payload.empresa === 'TOKENIZA' ? 'GPCT' : 'SPIN';
      
      await supabase.from('lead_conversation_state').insert({
        lead_id: payload.lead_id, empresa: payload.empresa,
        canal: 'WHATSAPP', estado_funil: 'SAUDACAO',
        framework_ativo: defaultFramework, modo: 'SDR_IA',
        idioma_preferido: 'PT', ultimo_contato_em: new Date().toISOString(),
      } as Record<string, unknown>);
    }

    // Classificação do lead (mantida para enriquecimento)
    let classification: LeadClassificationResult | null = null;

    try {
      classification = await classificarLead(supabase, newEvent.id, leadNormalizado);
      log.info('Lead classificado', {
        icp: classification.icp, temperatura: classification.temperatura,
        prioridade: classification.prioridade, scoreInterno: classification.scoreInterno,
      });

      await supabase.from('sgt_events').update({ processado_em: new Date().toISOString() }).eq('id', newEvent.id);

      await supabase.from('sgt_event_logs').insert({
        event_id: newEvent.id, status: 'PROCESSADO',
        mensagem: `Enriquecimento concluído — ICP: ${classification.icp}, Temp: ${classification.temperatura}`,
      } as Record<string, unknown>);

    } catch (classificationError) {
      log.error('Erro na classificação', { error: classificationError instanceof Error ? classificationError.message : String(classificationError) });
      
      await supabase.from('sgt_event_logs').insert({
        event_id: newEvent.id, status: 'ERRO',
        mensagem: 'Erro na classificação do lead',
        erro_stack: classificationError instanceof Error ? classificationError.stack : String(classificationError),
      } as Record<string, unknown>);
    }

    return new Response(
      JSON.stringify({
        success: true, event_id: newEvent.id,
        lead_id: payload.lead_id, evento: payload.evento, empresa: payload.empresa,
        enrichment_only: true,
        classification: classification ? {
          icp: classification.icp, persona: classification.persona,
          temperatura: classification.temperatura, prioridade: classification.prioridade,
          score_interno: classification.scoreInterno,
        } : null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    log.error('Erro geral', { error: error instanceof Error ? error.message : String(error) });
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
