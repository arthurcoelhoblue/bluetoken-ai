import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { createServiceClient, getOptionalEnv } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

// ========================================
// PATCH 5F - WhatsApp Inbound Webhook
// Recebe mensagens de leads via WhatsApp
// ========================================

import { getWebhookCorsHeaders, handleWebhookCorsOptions } from "../_shared/cors.ts";
import { checkWebhookRateLimit, rateLimitResponse, simpleHash } from "../_shared/webhook-rate-limit.ts";

const log = createLogger('whatsapp-inbound');
const corsHeaders = getWebhookCorsHeaders("x-api-key");

// ========================================
// TIPOS
// ========================================
type EmpresaTipo = 'TOKENIZA' | 'BLUE';

interface InboundPayload {
  from: string;
  message_id: string;
  timestamp: string;
  text: string;
  media_url?: string;
  media_type?: string;
}

interface LeadContact {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  nome: string | null;
  telefone: string | null;
}

interface LeadCadenceRun {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  status: string;
}

interface InboundResult {
  success: boolean;
  messageId?: string;
  leadId?: string | null;
  runId?: string | null;
  status: 'MATCHED' | 'UNMATCHED' | 'DUPLICATE' | 'ERROR';
  error?: string;
}

// ========================================
// UTILITÁRIOS
// ========================================

function normalizePhone(raw: string): string {
  let normalized = raw.replace(/\D/g, '');
  if (normalized.length === 11) {
    normalized = '55' + normalized;
  }
  return normalized;
}

function validateAuth(req: Request): boolean {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');
  
  const inboundSecret = getOptionalEnv('WHATSAPP_INBOUND_SECRET');
  
  if (!inboundSecret) {
    log.error('WHATSAPP_INBOUND_SECRET não configurado');
    return false;
  }
  
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token === inboundSecret) {
      return true;
    }
  }
  
  if (apiKeyHeader === inboundSecret) {
    return true;
  }
  
  log.warn('Token inválido');
  return false;
}

function generatePhoneVariations(phone: string): string[] {
  const variations: string[] = [phone];
  
  const withoutDDI = phone.startsWith('55') ? phone.slice(2) : phone;
  const ddd = withoutDDI.slice(0, 2);
  const number = withoutDDI.slice(2);
  
  if (number.length === 8) {
    const withNine = `55${ddd}9${number}`;
    variations.push(withNine);
    variations.push(`${ddd}9${number}`);
  }
  
  if (number.length === 9 && number.startsWith('9')) {
    const withoutNine = `55${ddd}${number.slice(1)}`;
    variations.push(withoutNine);
    variations.push(`${ddd}${number.slice(1)}`);
  }
  
  variations.push(withoutDDI);
  
  return [...new Set(variations)];
}

async function checkPendingHandoff(
  supabase: SupabaseClient,
  phoneE164: string
): Promise<{ empresaDestino: EmpresaTipo; leadIdOrigem: string } | null> {
  const { data: leads } = await supabase
    .from('lead_contacts')
    .select('lead_id, empresa')
    .eq('telefone_e164', phoneE164);
  
  if (!leads || leads.length === 0) return null;
  
  for (const lead of leads) {
    const { data: state } = await supabase
      .from('lead_conversation_state')
      .select('empresa_proxima_msg')
      .eq('lead_id', lead.lead_id)
      .eq('empresa', lead.empresa)
      .not('empresa_proxima_msg', 'is', null)
      .maybeSingle();
    
    if (state?.empresa_proxima_msg) {
      log.info('Handoff pendente encontrado', {
        de: lead.empresa,
        para: state.empresa_proxima_msg,
        leadOrigem: lead.lead_id,
      });
      return {
        empresaDestino: state.empresa_proxima_msg as EmpresaTipo,
        leadIdOrigem: lead.lead_id
      };
    }
  }
  
  return null;
}

async function clearHandoffFlag(
  supabase: SupabaseClient,
  leadId: string,
  empresa: EmpresaTipo
): Promise<void> {
  await supabase
    .from('lead_conversation_state')
    .update({ empresa_proxima_msg: null, updated_at: new Date().toISOString() })
    .eq('lead_id', leadId)
    .eq('empresa', empresa);
  
  log.info('Handoff flag limpo', { leadId, empresa });
}

async function findLeadByPhone(
  supabase: SupabaseClient,
  phoneNormalized: string
): Promise<{ lead: LeadContact | null; handoffInfo?: { leadIdOrigem: string; empresaOrigem: EmpresaTipo } }> {
  log.info('Buscando lead por telefone em TODAS empresas', { phone: phoneNormalized });
  
  const e164 = phoneNormalized.startsWith('+') 
    ? phoneNormalized 
    : `+${phoneNormalized}`;
  
  const handoff = await checkPendingHandoff(supabase, e164);
  
  if (handoff) {
    const { data: leadDestino } = await supabase
      .from('lead_contacts')
      .select('*')
      .eq('telefone_e164', e164)
      .eq('empresa', handoff.empresaDestino)
      .maybeSingle();
    
    if (leadDestino) {
      log.info('Handoff: roteando para empresa destino', { empresa: handoff.empresaDestino, leadId: (leadDestino as LeadContact).lead_id });
      
      const { data: leadOrigem } = await supabase
        .from('lead_contacts')
        .select('empresa')
        .eq('lead_id', handoff.leadIdOrigem)
        .maybeSingle();
      
      return { 
        lead: leadDestino as LeadContact,
        handoffInfo: {
          leadIdOrigem: handoff.leadIdOrigem,
          empresaOrigem: leadOrigem?.empresa as EmpresaTipo
        }
      };
    }
    
    log.info('Lead não existe na empresa destino, buscando origem');
  }
  
  const { data: e164Matches } = await supabase
    .from('lead_contacts')
    .select('*')
    .eq('telefone_e164', e164)
    .order('updated_at', { ascending: false });
    
  if (e164Matches && e164Matches.length > 0) {
    log.info('Encontrados leads por telefone_e164', { count: e164Matches.length });
    
    for (const lead of e164Matches as LeadContact[]) {
      const { data: activeRun } = await supabase
        .from('lead_cadence_runs')
        .select('id')
        .eq('lead_id', lead.lead_id)
        .eq('empresa', lead.empresa)
        .eq('status', 'ATIVA')
        .limit(1)
        .maybeSingle();
      
      if (activeRun) {
        log.info('Match com cadência ativa', { leadId: lead.lead_id, empresa: lead.empresa });
        return { lead };
      }
    }
    
    log.info('Match por telefone_e164 (mais recente)', { leadId: (e164Matches[0] as LeadContact).lead_id });
    return { lead: e164Matches[0] as LeadContact };
  }
  
  const variations = generatePhoneVariations(phoneNormalized);
  log.debug('Variações a testar', { variations });
  
  for (const variant of variations) {
    const { data: matches } = await supabase
      .from('lead_contacts')
      .select('*')
      .eq('telefone', variant)
      .order('updated_at', { ascending: false });
      
    if (matches && matches.length > 0) {
      for (const lead of matches as LeadContact[]) {
        const { data: activeRun } = await supabase
          .from('lead_cadence_runs')
          .select('id')
          .eq('lead_id', lead.lead_id)
          .eq('empresa', lead.empresa)
          .eq('status', 'ATIVA')
          .limit(1)
          .maybeSingle();
        
        if (activeRun) {
          log.info('Match exato com cadência ativa', { leadId: lead.lead_id, empresa: lead.empresa });
          return { lead };
        }
      }
      
      log.info('Match exato (mais recente)', { leadId: (matches[0] as LeadContact).lead_id });
      return { lead: matches[0] as LeadContact };
    }
  }
  
  const last8Digits = phoneNormalized.slice(-8);
  const { data: partialMatches } = await supabase
    .from('lead_contacts')
    .select('*')
    .like('telefone', `%${last8Digits}`)
    .order('updated_at', { ascending: false });
    
  if (partialMatches && partialMatches.length > 0) {
    for (const lead of partialMatches as LeadContact[]) {
      const { data: activeRun } = await supabase
        .from('lead_cadence_runs')
        .select('id')
        .eq('lead_id', lead.lead_id)
        .eq('empresa', lead.empresa)
        .eq('status', 'ATIVA')
        .limit(1)
        .maybeSingle();
      
      if (activeRun) {
        log.info('Match parcial com cadência ativa', { leadId: lead.lead_id, empresa: lead.empresa });
        return { lead };
      }
    }
    
    log.info('Match parcial (mais recente)', { leadId: (partialMatches[0] as LeadContact).lead_id });
    return { lead: partialMatches[0] as LeadContact };
  }
  
  log.info('Tentando fallback por último OUTBOUND...');
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  const { data: lastOutbound } = await supabase
    .from('lead_messages')
    .select('lead_id, empresa')
    .eq('direcao', 'OUTBOUND')
    .eq('canal', 'WHATSAPP')
    .eq('estado', 'ENVIADO')
    .gte('created_at', thirtyMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastOutbound && lastOutbound.lead_id) {
    log.info('Fallback: encontrado OUTBOUND recente', { leadId: lastOutbound.lead_id });
    
    const { data: leadData } = await supabase
      .from('lead_contacts')
      .select('*')
      .eq('lead_id', lastOutbound.lead_id)
      .eq('empresa', lastOutbound.empresa)
      .maybeSingle();
    
    if (leadData) {
      log.info('Fallback: associando ao lead do último OUTBOUND', { leadId: (leadData as LeadContact).lead_id, empresa: (leadData as LeadContact).empresa });
      return { lead: leadData as LeadContact };
    }
  }
  
  log.info('Nenhum lead encontrado', { phone: phoneNormalized });
  return { lead: null };
}

async function findActiveRun(
  supabase: SupabaseClient,
  leadId: string,
  empresa: EmpresaTipo
): Promise<LeadCadenceRun | null> {
  const { data } = await supabase
    .from('lead_cadence_runs')
    .select('*')
    .eq('lead_id', leadId)
    .eq('empresa', empresa)
    .eq('status', 'ATIVA')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (data) {
    log.info('Run ativa encontrada', { runId: (data as LeadCadenceRun).id });
    return data as LeadCadenceRun;
  }
  
  return null;
}

async function isDuplicate(
  supabase: SupabaseClient,
  messageId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('lead_messages')
    .select('id')
    .eq('whatsapp_message_id', messageId)
    .limit(1)
    .maybeSingle();
    
  return !!data;
}

async function saveInboundMessage(
  supabase: SupabaseClient,
  payload: InboundPayload,
  leadContact: LeadContact | null,
  activeRun: LeadCadenceRun | null
): Promise<InboundResult> {
  if (await isDuplicate(supabase, payload.message_id)) {
    log.info('Mensagem duplicada', { messageId: payload.message_id });
    return {
      success: true,
      status: 'DUPLICATE',
      messageId: payload.message_id,
    };
  }
  
  const empresa: EmpresaTipo = leadContact?.empresa || 'TOKENIZA';
  
  const messageRecord = {
    lead_id: leadContact?.lead_id || null,
    empresa,
    run_id: activeRun?.id || null,
    canal: 'WHATSAPP',
    direcao: 'INBOUND',
    conteudo: payload.text,
    estado: leadContact ? 'RECEBIDO' : 'UNMATCHED',
    whatsapp_message_id: payload.message_id,
    recebido_em: payload.timestamp,
  };
  
  log.info('Salvando mensagem', {
    from: normalizePhone(payload.from),
    leadId: messageRecord.lead_id,
    runId: messageRecord.run_id,
    estado: messageRecord.estado,
  });
  
  const { data, error } = await supabase
    .from('lead_messages')
    .insert(messageRecord)
    .select('id')
    .single();
    
  if (error) {
    log.error('Erro ao salvar', { error: error.message });
    return {
      success: false,
      status: 'ERROR',
      error: error.message,
    };
  }
  
  const savedMessage = data as { id: string };
  log.info('Mensagem salva', { messageId: savedMessage.id });
  
  if (activeRun) {
    await supabase.from('lead_cadence_events').insert({
      lead_cadence_run_id: activeRun.id,
      step_ordem: 0,
      template_codigo: 'INBOUND_RESPONSE',
      tipo_evento: 'RESPOSTA_DETECTADA',
      detalhes: {
        message_id: savedMessage.id,
        whatsapp_message_id: payload.message_id,
        preview: payload.text.substring(0, 100),
      },
    });
    log.info('Evento RESPOSTA_DETECTADA registrado');
  }
  
  return {
    success: true,
    messageId: savedMessage.id,
    leadId: leadContact?.lead_id || null,
    runId: activeRun?.id || null,
    status: leadContact ? 'MATCHED' : 'UNMATCHED',
  };
}

// ========================================
// Handler Principal
// ========================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!validateAuth(req)) {
    log.error('Acesso não autorizado');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const rawPayload = await req.json();

    const inboundSchema = z.object({
      from: z.string().min(8, 'Phone number required').max(20),
      message_id: z.string().min(1, 'message_id required').max(200),
      timestamp: z.string().optional(),
      text: z.string().min(1, 'Message text required').max(10000),
      media_url: z.string().url().optional(),
      media_type: z.string().optional(),
    });

    const parsed = inboundSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.errors[0]?.message || 'Invalid payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const payload: InboundPayload = parsed.data;
    
    log.info('Webhook recebido', {
      from: payload.from,
      message_id: payload.message_id,
      textPreview: payload.text?.substring(0, 50),
    });

    const phoneNormalized = normalizePhone(payload.from);
    
    const supabase = createServiceClient();

    const rateLimitId = simpleHash((getOptionalEnv('WHATSAPP_INBOUND_SECRET') || '') + phoneNormalized);
    const rateCheck = await checkWebhookRateLimit(supabase, 'whatsapp-inbound', rateLimitId, 200);
    if (!rateCheck.allowed) {
      log.warn('Rate limit exceeded', { currentCount: rateCheck.currentCount });
      return rateLimitResponse(corsHeaders);
    }

    const { lead: leadContact, handoffInfo } = await findLeadByPhone(supabase, phoneNormalized);
    
    if (leadContact) {
      const { data: channelConfig } = await supabase
        .from('integration_company_config')
        .select('enabled')
        .eq('empresa', leadContact.empresa)
        .eq('channel', 'mensageria')
        .maybeSingle();

      if (channelConfig && !channelConfig.enabled) {
        log.info('Canal mensageria desabilitado', { empresa: leadContact.empresa });
        return new Response(
          JSON.stringify({ 
            success: false, 
            status: 'CHANNEL_DISABLED',
            error: `Mensageria não está habilitada para ${leadContact.empresa}`,
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    let activeRun: LeadCadenceRun | null = null;
    if (leadContact) {
      activeRun = await findActiveRun(supabase, leadContact.lead_id, leadContact.empresa);
    }
    
    const result = await saveInboundMessage(supabase, payload, leadContact, activeRun);
    
    if (handoffInfo) {
      await clearHandoffFlag(supabase, handoffInfo.leadIdOrigem, handoffInfo.empresaOrigem);
      log.info('Handoff processado', {
        de: handoffInfo.empresaOrigem,
        para: leadContact?.empresa,
        leadOrigem: handoffInfo.leadIdOrigem,
        leadDestino: leadContact?.lead_id,
      });
    }
    
    // Notificação para leads quentes
    if (result.success && result.status === 'MATCHED' && leadContact) {
      try {
        const { data: classif } = await supabase
          .from('lead_classifications')
          .select('temperatura')
          .eq('lead_id', leadContact.lead_id)
          .maybeSingle();

        if (classif && (classif as Record<string, unknown>).temperatura === 'QUENTE') {
          const { data: ownerData } = await supabase
            .from('contacts')
            .select('owner_id')
            .eq('legacy_lead_id', leadContact.lead_id)
            .maybeSingle();

          if (ownerData && (ownerData as Record<string, unknown>).owner_id) {
            await supabase.from('notifications').insert({
              user_id: (ownerData as Record<string, unknown>).owner_id,
              empresa: leadContact.empresa,
              tipo: 'LEAD_QUENTE',
              titulo: `Lead quente respondeu: ${leadContact.nome || 'Sem nome'}`,
              mensagem: payload.text.substring(0, 200),
              link: `/leads/${leadContact.lead_id}`,
              entity_id: leadContact.lead_id,
              entity_type: 'LEAD',
            });
            log.info('Notificação LEAD_QUENTE enviada');
          }
        }
      } catch (notifErr) {
        log.error('Erro ao criar notificação', { error: String(notifErr) });
      }
    }

    // Disparar interpretação IA (PATCH 5G)
    if (result.success && result.messageId && result.status === 'MATCHED') {
      const MAX_RETRIES = 2;
      const RETRY_DELAY_MS = 2000;
      
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = (await import('../_shared/config.ts')).envConfig;
          const response = await fetch(`${SUPABASE_URL}/functions/v1/sdr-ia-interpret`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ messageId: result.messageId }),
          });
          
          if (response.ok) {
            const iaResult = await response.json();
            log.info('Interpretação IA concluída', iaResult);
            (result as Record<string, unknown>).iaInterpretation = iaResult;
            break;
          } else {
            log.error(`Erro ao chamar SDR IA (tentativa ${attempt + 1}/${MAX_RETRIES + 1})`, { status: response.status });
            if (attempt < MAX_RETRIES && [500, 502, 503, 504].includes(response.status)) {
              await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
            }
          }
        } catch (iaError) {
          log.error(`Erro ao disparar interpretação (tentativa ${attempt + 1}/${MAX_RETRIES + 1})`, { error: String(iaError) });
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
          }
        }
      }
    }
    
    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    log.error('Erro geral', { error: String(error) });
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
