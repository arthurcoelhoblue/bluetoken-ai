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
type EmpresaTipo = 'TOKENIZA' | 'BLUE' | 'BLUE_LABS';

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

interface CrmContact {
  id: string;
  legacy_lead_id: string | null;
  empresa: EmpresaTipo;
  nome: string;
  telefone: string | null;
  telefone_e164: string | null;
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
  
  // Só adiciona DDI 55 se tem exatamente 10-11 dígitos (DDD + número BR)
  // Números com 12+ dígitos já têm DDI (ex: 351910506655 = Portugal)
  if (normalized.length === 10 || normalized.length === 11) {
    normalized = '55' + normalized;
  }
  
  return normalized;
}

function validateAuth(req: Request): boolean {
  // Debug: logar todos os headers para identificar formato da Mensageria
  const headerNames = [...req.headers.keys()];
  log.info('Headers recebidos no inbound', { headers: headerNames });
  
  const inboundSecret = getOptionalEnv('WHATSAPP_INBOUND_SECRET');
  
  if (!inboundSecret) {
    log.error('WHATSAPP_INBOUND_SECRET não configurado');
    return false;
  }
  
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token === inboundSecret) {
      log.info('Auth via Authorization Bearer');
      return true;
    }
  }
  
  // 2. X-API-Key header
  const apiKeyHeader = req.headers.get('X-API-Key');
  if (apiKeyHeader === inboundSecret) {
    log.info('Auth via X-API-Key');
    return true;
  }
  
  // 3. x-webhook-secret header (como sgt-webhook usa)
  const xWebhookSecret = req.headers.get('x-webhook-secret');
  if (xWebhookSecret === inboundSecret) {
    log.info('Auth via x-webhook-secret');
    return true;
  }
  
  // 4. apikey header (padrão Supabase)
  const apiKeyLower = req.headers.get('apikey');
  if (apiKeyLower === inboundSecret) {
    log.info('Auth via apikey');
    return true;
  }
  
  // 5. token header
  const tokenHeader = req.headers.get('token');
  if (tokenHeader === inboundSecret) {
    log.info('Auth via token header');
    return true;
  }
  
  // 6. Query param ?key=<secret>
  try {
    const url = new URL(req.url);
    const keyParam = url.searchParams.get('key');
    if (keyParam === inboundSecret) {
      log.info('Auth via query param key');
      return true;
    }
  } catch (_) { /* ignore */ }
  
  log.warn('Token inválido', { 
    hasAuth: !!authHeader, 
    hasApiKey: !!apiKeyHeader,
    hasWebhookSecret: !!xWebhookSecret,
    hasApiKeyLower: !!apiKeyLower,
    hasToken: !!req.headers.get('token'),
  });
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
  activeRun: LeadCadenceRun | null,
  crmContactId?: string | null,
  crmEmpresa?: EmpresaTipo | null
): Promise<InboundResult> {
  if (await isDuplicate(supabase, payload.message_id)) {
    log.info('Mensagem duplicada', { messageId: payload.message_id });
    return {
      success: true,
      status: 'DUPLICATE',
      messageId: payload.message_id,
    };
  }
  
  const empresa: EmpresaTipo = leadContact?.empresa || crmEmpresa || 'TOKENIZA';
  const isMatched = !!(leadContact || crmContactId);
  
  const messageRecord: Record<string, unknown> = {
    lead_id: leadContact?.lead_id || null,
    empresa,
    run_id: activeRun?.id || null,
    canal: 'WHATSAPP',
    direcao: 'INBOUND',
    conteudo: payload.text,
    estado: isMatched ? 'RECEBIDO' : 'UNMATCHED',
    whatsapp_message_id: payload.message_id,
    recebido_em: payload.timestamp,
  };
  
  // Set contact_id if we have a CRM contact match
  if (crmContactId) {
    messageRecord.contact_id = crmContactId;
  }
  
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

    log.debug('Raw payload recebido', { keys: Object.keys(rawPayload), from: rawPayload.from });

    // Normalizar campos: Mensageria envia 'message' e 'messageId',
    // mas o schema interno espera 'text' e 'message_id'
    const normalizedPayload = {
      from: rawPayload.from,
      message_id: rawPayload.message_id || rawPayload.messageId || '',
      timestamp: rawPayload.timestamp,
      text: rawPayload.text || rawPayload.message || '',
      media_url: rawPayload.media_url,
      media_type: rawPayload.media_type,
    };

    const inboundSchema = z.object({
      from: z.string().min(8, 'Phone number required').max(20),
      message_id: z.string().min(1, 'message_id required').max(200),
      timestamp: z.string().optional(),
      text: z.string().min(1, 'Message text required').max(10000),
      media_url: z.string().url().optional(),
      media_type: z.string().optional(),
    });

    const parsed = inboundSchema.safeParse(normalizedPayload);
    if (!parsed.success) {
      log.warn('Payload inválido', { errors: parsed.error.errors, rawKeys: Object.keys(rawPayload) });
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
    
    // Fallback: buscar na tabela contacts (CRM) se não encontrou em lead_contacts
    let crmContact: CrmContact | null = null;
    if (!leadContact) {
      const e164 = phoneNormalized.startsWith('+') ? phoneNormalized : `+${phoneNormalized}`;
      const rawDigits = payload.from.replace(/\D/g, '');
      
      // 1. Busca por telefone_e164
      const { data: contactMatch } = await supabase
        .from('contacts')
        .select('id, legacy_lead_id, empresa, nome, telefone, telefone_e164')
        .eq('telefone_e164', e164)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (contactMatch) {
        crmContact = contactMatch as CrmContact;
        log.info('Match via contacts CRM (telefone_e164)', { contactId: crmContact.id, empresa: crmContact.empresa });
      }
      
      // 2. Fallback: buscar pelo campo telefone raw (cobre telefone_e164 = NULL)
      if (!crmContact) {
        const phonesToTry = [...new Set([rawDigits, phoneNormalized, e164])];
        for (const phone of phonesToTry) {
          const { data: rawMatch } = await supabase
            .from('contacts')
            .select('id, legacy_lead_id, empresa, nome, telefone, telefone_e164')
            .eq('telefone', phone)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (rawMatch) {
            crmContact = rawMatch as CrmContact;
            log.info('Match via contacts CRM (telefone raw)', { contactId: crmContact.id, telefone: phone, empresa: crmContact.empresa });
            break;
          }
        }
      }
      
      // 3. Fallback: últimos 8 dígitos em telefone_e164 OU telefone
      if (!crmContact) {
        const last8 = phoneNormalized.slice(-8);
        const { data: partialContact } = await supabase
          .from('contacts')
          .select('id, legacy_lead_id, empresa, nome, telefone, telefone_e164')
          .or(`telefone_e164.like.%${last8},telefone.like.%${last8}`)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (partialContact) {
          crmContact = partialContact as CrmContact;
          log.info('Match parcial via contacts CRM', { contactId: crmContact.id, empresa: crmContact.empresa });
        }
      }
    }

    let matchedEmpresa = leadContact?.empresa || crmContact?.empresa;
    let finalLeadContact = leadContact;
    let finalCrmContact = crmContact;
    
    // Verificar se a empresa encontrada tem mensageria habilitada
    // Se não tiver, buscar alternativa em empresa com canal ativo
    if (matchedEmpresa) {
      const { data: channelConfig } = await supabase
        .from('integration_company_config')
        .select('enabled')
        .eq('empresa', matchedEmpresa)
        .eq('channel', 'mensageria')
        .maybeSingle();

      if (channelConfig && !channelConfig.enabled) {
        log.info('Canal mensageria desabilitado para empresa inicial, buscando alternativa', { empresa: matchedEmpresa });
        
        // Buscar TODAS as empresas com mensageria habilitada
        const { data: enabledEmpresas } = await supabase
          .from('integration_company_config')
          .select('empresa')
          .eq('channel', 'mensageria')
          .eq('enabled', true);
        
        const empresasAtivas = (enabledEmpresas || []).map((e: { empresa: string }) => e.empresa);
        log.info('Empresas com mensageria ativa', { empresas: empresasAtivas });
        
        if (empresasAtivas.length > 0) {
          let found = false;
          
          // Tentar encontrar lead_contact em empresa com mensageria ativa
          const e164 = phoneNormalized.startsWith('+') ? phoneNormalized : `+${phoneNormalized}`;
          
          const { data: altLeads } = await supabase
            .from('lead_contacts')
            .select('*')
            .eq('telefone_e164', e164)
            .in('empresa', empresasAtivas)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (altLeads) {
            finalLeadContact = altLeads as LeadContact;
            finalCrmContact = null;
            matchedEmpresa = finalLeadContact.empresa;
            found = true;
            log.info('Alternativa encontrada em lead_contacts', { empresa: matchedEmpresa, leadId: finalLeadContact.lead_id });
          }
          
          // Tentar contacts CRM se não achou em lead_contacts
          if (!found) {
            const { data: altContact } = await supabase
              .from('contacts')
              .select('id, legacy_lead_id, empresa, nome, telefone, telefone_e164')
              .or(`telefone_e164.eq.${e164},telefone.eq.${phoneNormalized}`)
              .in('empresa', empresasAtivas)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (altContact) {
              finalCrmContact = altContact as CrmContact;
              finalLeadContact = null;
              matchedEmpresa = finalCrmContact.empresa;
              found = true;
              log.info('Alternativa encontrada em contacts CRM', { empresa: matchedEmpresa, contactId: finalCrmContact.id });
            }
          }
          
          if (!found) {
            log.info('Nenhuma alternativa com mensageria ativa encontrada');
            return new Response(
              JSON.stringify({ 
                success: false, 
                status: 'CHANNEL_DISABLED',
                error: `Mensageria não está habilitada para nenhuma empresa com este telefone`,
              }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          log.info('Nenhuma empresa tem mensageria ativa');
          return new Response(
            JSON.stringify({ 
              success: false, 
              status: 'CHANNEL_DISABLED',
              error: `Mensageria não está habilitada para nenhuma empresa`,
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }
    
    let activeRun: LeadCadenceRun | null = null;
    if (finalLeadContact) {
      activeRun = await findActiveRun(supabase, finalLeadContact.lead_id, finalLeadContact.empresa);
    }
    
    const result = await saveInboundMessage(supabase, payload, finalLeadContact, activeRun, finalCrmContact?.id, finalCrmContact?.empresa);
    
    if (handoffInfo) {
      await clearHandoffFlag(supabase, handoffInfo.leadIdOrigem, handoffInfo.empresaOrigem);
      log.info('Handoff processado', {
        de: handoffInfo.empresaOrigem,
        para: finalLeadContact?.empresa,
        leadOrigem: handoffInfo.leadIdOrigem,
        leadDestino: finalLeadContact?.lead_id,
      });
    }
    
    // Notificação para leads quentes
    if (result.success && result.status === 'MATCHED' && finalLeadContact) {
      try {
        const { data: classif } = await supabase
          .from('lead_classifications')
          .select('temperatura')
          .eq('lead_id', finalLeadContact.lead_id)
          .maybeSingle();

        if (classif && (classif as Record<string, unknown>).temperatura === 'QUENTE') {
          const { data: ownerData } = await supabase
            .from('contacts')
            .select('owner_id')
            .eq('legacy_lead_id', finalLeadContact.lead_id)
            .maybeSingle();

          if (ownerData && (ownerData as Record<string, unknown>).owner_id) {
            await supabase.from('notifications').insert({
              user_id: (ownerData as Record<string, unknown>).owner_id,
              empresa: finalLeadContact.empresa,
              tipo: 'LEAD_QUENTE',
              titulo: `Lead quente respondeu: ${finalLeadContact.nome || 'Sem nome'}`,
              mensagem: payload.text.substring(0, 200),
              link: `/leads/${finalLeadContact.lead_id}`,
              entity_id: finalLeadContact.lead_id,
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
