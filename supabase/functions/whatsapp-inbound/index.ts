import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { createServiceClient, getOptionalEnv } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

// ========================================
// PATCH 5F - WhatsApp Inbound Webhook
// Arquitetura EMPRESA-FIRST: determina a empresa dona do webhook
// ANTES de buscar leads, garantindo isolamento total entre tenants.
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

// ========================================
// HMAC-SHA256 Signature Verification
// ========================================

async function verifyHmacSignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const bodyData = encoder.encode(rawBody);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, bodyData);
    const computedHex = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Compare case-insensitively
    const isValid = computedHex.toLowerCase() === signature.toLowerCase();
    if (!isValid) {
      log.warn('HMAC signature mismatch', { 
        expected: computedHex.substring(0, 12) + '...', 
        received: signature.substring(0, 12) + '...' 
      });
    }
    return isValid;
  } catch (err) {
    log.error('Erro ao verificar HMAC', { error: String(err) });
    return false;
  }
}

function validateAuth(req: Request, bodySecret?: string): boolean {
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
    const token = authHeader.replace('Bearer ', '').trim();
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
  
  // 3. x-webhook-secret header
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
  
  // 7. Auth via body field (auth_token ou secret)
  if (bodySecret && bodySecret === inboundSecret) {
    log.info('Auth via body secret');
    return true;
  }
  
  log.warn('Token inválido', { 
    hasAuth: !!authHeader, 
    hasApiKey: !!apiKeyHeader,
    hasWebhookSecret: !!xWebhookSecret,
    hasApiKeyLower: !!apiKeyLower,
    hasToken: !!req.headers.get('token'),
    hasBodySecret: !!bodySecret,
  });
  return false;
}

// ========================================
// EMPRESA-FIRST: Resolver empresa dona do webhook
// ========================================

/**
 * Resolve empresa precisamente via connection_name.
 * Busca na tabela integration_company_config onde connection_name = valor E channel = 'mensageria'.
 */
async function resolveEmpresaByConnectionName(
  supabase: SupabaseClient,
  connectionName: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('integration_company_config')
    .select('empresa')
    .eq('connection_name', connectionName)
    .eq('channel', 'mensageria')
    .eq('enabled', true)
    .maybeSingle();

  if (error) {
    log.error('Erro ao resolver empresa por connection_name', { error: error.message, connectionName });
    return null;
  }

  if (data) {
    const empresa = (data as { empresa: string }).empresa;
    log.info('Empresa resolvida via connection_name', { connectionName, empresa });
    return empresa;
  }

  log.warn('Nenhuma empresa encontrada para connection_name', { connectionName });
  return null;
}

/**
 * Determina qual(is) empresa(s) possuem mensageria totalmente configurada.
 * Retorna lista de empresas com channel='mensageria', enabled=true E api_key configurada.
 * Se nenhuma encontrada, retorna array vazio (fallback para busca global).
 */
async function resolveEmpresaFromWebhook(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('integration_company_config')
    .select('empresa')
    .eq('channel', 'mensageria')
    .eq('enabled', true)
    .not('api_key', 'is', null);
  
  if (error) {
    log.error('Erro ao resolver empresa do webhook', { error: error.message });
    return [];
  }
  
  const empresas = (data || []).map((e: { empresa: string }) => e.empresa);
  log.info('Empresas com mensageria configurada (empresa-first)', { empresas });
  return empresas;
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

/**
 * EMPRESA-FIRST: Busca lead pelo telefone, filtrando por targetEmpresas quando fornecido.
 * Se targetEmpresas estiver preenchido, TODAS as queries filtram apenas essas empresas.
 * Isso garante isolamento total entre tenants.
 */
async function findLeadByPhone(
  supabase: SupabaseClient,
  phoneNormalized: string,
  targetEmpresas?: string[]
): Promise<{ lead: LeadContact | null; handoffInfo?: { leadIdOrigem: string; empresaOrigem: EmpresaTipo } }> {
  const hasFilter = targetEmpresas && targetEmpresas.length > 0;
  log.info('Buscando lead por telefone', { 
    phone: phoneNormalized, 
    targetEmpresas: hasFilter ? targetEmpresas : 'TODAS (sem filtro)',
  });
  
  const e164 = phoneNormalized.startsWith('+') 
    ? phoneNormalized 
    : `+${phoneNormalized}`;
  
  // Handoff check (sem filtro de empresa - handoff pode cruzar empresas por design)
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
    
    log.info('Lead não existe na empresa destino, continuando busca filtrada');
  }
  
  // ---- E.164 match ----
  let e164Query = supabase
    .from('lead_contacts')
    .select('*')
    .eq('telefone_e164', e164)
    .order('updated_at', { ascending: false });
  
  if (hasFilter) {
    e164Query = e164Query.in('empresa', targetEmpresas!);
  }
  
  const { data: e164Matches } = await e164Query;
    
  if (e164Matches && e164Matches.length > 0) {
    log.info('Encontrados leads por telefone_e164', { count: e164Matches.length, empresas: (e164Matches as LeadContact[]).map(l => l.empresa) });
    
    // Priorizar lead com cadência ativa
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
        log.info('Match E.164 com cadência ativa', { leadId: lead.lead_id, empresa: lead.empresa });
        return { lead };
      }
    }
    
    // Sem cadência ativa → primeiro match (já filtrado por empresa)
    log.info('Match E.164 (primeiro resultado filtrado)', { leadId: (e164Matches[0] as LeadContact).lead_id, empresa: (e164Matches[0] as LeadContact).empresa });
    return { lead: e164Matches[0] as LeadContact };
  }
  
  // ---- Variação match ----
  const variations = generatePhoneVariations(phoneNormalized);
  log.debug('Variações a testar', { variations });
  
  for (const variant of variations) {
    let varQuery = supabase
      .from('lead_contacts')
      .select('*')
      .eq('telefone', variant)
      .order('updated_at', { ascending: false });
    
    if (hasFilter) {
      varQuery = varQuery.in('empresa', targetEmpresas!);
    }
    
    const { data: matches } = await varQuery;
      
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
          log.info('Match variação com cadência ativa', { leadId: lead.lead_id, empresa: lead.empresa });
          return { lead };
        }
      }
      
      log.info('Match variação (primeiro resultado filtrado)', { leadId: (matches[0] as LeadContact).lead_id, empresa: (matches[0] as LeadContact).empresa });
      return { lead: matches[0] as LeadContact };
    }
  }
  
  // ---- Match parcial (últimos 8 dígitos) ----
  const last8Digits = phoneNormalized.slice(-8);
  let partialQuery = supabase
    .from('lead_contacts')
    .select('*')
    .like('telefone', `%${last8Digits}`)
    .order('updated_at', { ascending: false });
  
  if (hasFilter) {
    partialQuery = partialQuery.in('empresa', targetEmpresas!);
  }
  
  const { data: partialMatches } = await partialQuery;
    
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
    
    log.info('Match parcial (primeiro resultado filtrado)', { leadId: (partialMatches[0] as LeadContact).lead_id, empresa: (partialMatches[0] as LeadContact).empresa });
    return { lead: partialMatches[0] as LeadContact };
  }
  
  // ---- Fallback: último OUTBOUND recente ----
  log.info('Tentando fallback por último OUTBOUND...');
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  let outboundQuery = supabase
    .from('lead_messages')
    .select('lead_id, empresa')
    .eq('direcao', 'OUTBOUND')
    .eq('canal', 'WHATSAPP')
    .eq('estado', 'ENVIADO')
    .gte('created_at', thirtyMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (hasFilter) {
    outboundQuery = outboundQuery.in('empresa', targetEmpresas!);
  }
  
  const { data: lastOutbound } = await outboundQuery.maybeSingle();

  if (lastOutbound && lastOutbound.lead_id) {
    log.info('Fallback: encontrado OUTBOUND recente', { leadId: lastOutbound.lead_id, empresa: lastOutbound.empresa });
    
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
  
  log.info('Nenhum lead encontrado', { phone: phoneNormalized, targetEmpresas });
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
  crmEmpresa?: EmpresaTipo | null,
  targetEmpresa?: string | null
): Promise<InboundResult> {
  if (await isDuplicate(supabase, payload.message_id)) {
    log.info('Mensagem duplicada', { messageId: payload.message_id });
    return {
      success: true,
      status: 'DUPLICATE',
      messageId: payload.message_id,
    };
  }
  
  // EMPRESA-FIRST: usa empresa do lead/contact, ou a empresa-alvo do webhook, ou fallback
  const empresa: EmpresaTipo = (leadContact?.empresa || crmEmpresa || targetEmpresa || 'BLUE_LABS') as EmpresaTipo;
  let isMatched = !!(leadContact || crmContactId);
  let resolvedLeadId = leadContact?.lead_id || null;
  
  // Auto-criar lead_contact para números desconhecidos (UNMATCHED)
  if (!isMatched) {
    const phoneNormalized = normalizePhone(payload.from);
    const e164 = phoneNormalized.startsWith('+') ? phoneNormalized : `+${phoneNormalized}`;
    const phoneHash = simpleHash(e164).toString(36);
    const newLeadId = `inbound_${phoneHash}_${Date.now()}`;
    
    log.info('Auto-criando lead_contact para número desconhecido', { 
      newLeadId, empresa, e164 
    });
    
    // Verificar se já existe lead_contact com mesmo telefone_e164 + empresa (retry safety)
    const { data: existing } = await supabase
      .from('lead_contacts')
      .select('lead_id')
      .eq('telefone_e164', e164)
      .eq('empresa', empresa)
      .maybeSingle();
    
    if (existing) {
      resolvedLeadId = (existing as { lead_id: string }).lead_id;
      isMatched = true;
      log.info('Lead já existente para este telefone+empresa', { leadId: resolvedLeadId });
    } else {
      const { data: newLead, error: createError } = await supabase
        .from('lead_contacts')
        .insert({
          lead_id: newLeadId,
          empresa,
          telefone: phoneNormalized,
          telefone_e164: e164,
          origem_telefone: 'WHATSAPP_INBOUND',
        })
        .select('lead_id')
        .single();
      
      if (createError) {
        log.error('Erro ao auto-criar lead_contact', { error: createError.message });
      } else if (newLead) {
        resolvedLeadId = (newLead as { lead_id: string }).lead_id;
        isMatched = true;
        log.info('Lead auto-criado com sucesso', { leadId: resolvedLeadId, empresa });
        // O trigger fn_sync_lead_to_contact criará automaticamente o registro em contacts
      }
    }
  }
  
  const messageRecord: Record<string, unknown> = {
    lead_id: resolvedLeadId,
    empresa,
    run_id: activeRun?.id || null,
    canal: 'WHATSAPP',
    direcao: 'INBOUND',
    conteudo: payload.text,
    estado: isMatched ? 'RECEBIDO' : 'UNMATCHED',
    whatsapp_message_id: payload.message_id,
    recebido_em: payload.timestamp,
  };
  
  if (crmContactId) {
    messageRecord.contact_id = crmContactId;
  }
  
  log.info('Salvando mensagem', {
    from: normalizePhone(payload.from),
    leadId: messageRecord.lead_id,
    runId: messageRecord.run_id,
    estado: messageRecord.estado,
    empresa,
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
  log.info('Mensagem salva', { messageId: savedMessage.id, empresa });
  
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
    leadId: resolvedLeadId,
    runId: activeRun?.id || null,
    status: isMatched ? 'MATCHED' : 'UNMATCHED',
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

  try {
    // Ler body como texto bruto ANTES do parse para HMAC validation
    const rawBody = await req.text();
    const rawPayload = JSON.parse(rawBody);
    const bodySecret = rawPayload.auth_token || rawPayload.secret || null;

    if (!validateAuth(req, bodySecret)) {
      log.error('Acesso não autorizado');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validação opcional de X-Webhook-Signature (HMAC-SHA256)
    const webhookSignature = req.headers.get('X-Webhook-Signature');
    if (webhookSignature) {
      const inboundSecret = getOptionalEnv('WHATSAPP_INBOUND_SECRET');
      if (inboundSecret) {
        const isValidSignature = await verifyHmacSignature(rawBody, webhookSignature, inboundSecret);
        if (!isValidSignature) {
          log.error('HMAC signature inválida');
          return new Response(
            JSON.stringify({ error: 'Invalid webhook signature' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        log.info('HMAC signature válida');
      }
    }

    // Extrair connection_name do payload ou header
    const connectionName: string | null = rawPayload.connection_name 
      || req.headers.get('X-Connection-Name') 
      || null;

    log.debug('Raw payload recebido', { 
      keys: Object.keys(rawPayload), 
      from: rawPayload.from,
      connection_name: connectionName,
    });

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
      connection_name: connectionName,
    });

    const phoneNormalized = normalizePhone(payload.from);
    
    const supabase = createServiceClient();

    const rateLimitId = simpleHash((getOptionalEnv('WHATSAPP_INBOUND_SECRET') || '') + phoneNormalized);
    const rateCheck = await checkWebhookRateLimit(supabase, 'whatsapp-inbound', rateLimitId, 200);
    if (!rateCheck.allowed) {
      log.warn('Rate limit exceeded', { currentCount: rateCheck.currentCount });
      return rateLimitResponse(corsHeaders);
    }

    // ============================================================
    // EMPRESA-FIRST: Resolver empresa ANTES de buscar leads
    // Prioridade: connection_name > fallback (todas com mensageria)
    // ============================================================
    let targetEmpresas: string[] = [];
    let targetEmpresa: string | null = null;

    if (connectionName) {
      const empresa = await resolveEmpresaByConnectionName(supabase, connectionName);
      if (empresa) {
        targetEmpresas = [empresa];
        targetEmpresa = empresa;
        log.info('Empresa resolvida via connection_name', { connectionName, empresa });
      }
    }

    // Fallback: comportamento antigo (todas as empresas com mensageria habilitada)
    if (targetEmpresas.length === 0) {
      targetEmpresas = await resolveEmpresaFromWebhook(supabase);
      targetEmpresa = targetEmpresas.length === 1 ? targetEmpresas[0] : null;
    }
    
    log.info('Empresa-First resolvido', { 
      targetEmpresas, 
      targetEmpresa,
      connectionName,
      mode: connectionName && targetEmpresa 
        ? 'CONNECTION_NAME' 
        : targetEmpresas.length > 0 
          ? 'FILTRADO' 
          : 'GLOBAL (nenhuma empresa com mensageria)',
    });

    // Buscar lead filtrando por empresa-alvo (ou sem filtro se nenhuma configurada)
    const { lead: leadContact, handoffInfo } = await findLeadByPhone(
      supabase, 
      phoneNormalized, 
      targetEmpresas.length > 0 ? targetEmpresas : undefined
    );
    
    // Fallback: buscar na tabela contacts (CRM), também filtrado por empresa-alvo
    let crmContact: CrmContact | null = null;
    if (!leadContact) {
      const e164 = phoneNormalized.startsWith('+') ? phoneNormalized : `+${phoneNormalized}`;
      const rawDigits = payload.from.replace(/\D/g, '');
      
      // 1. Busca por telefone_e164 (filtrada por empresa)
      let contactE164Query = supabase
        .from('contacts')
        .select('id, legacy_lead_id, empresa, nome, telefone, telefone_e164')
        .eq('telefone_e164', e164)
        .order('updated_at', { ascending: false })
        .limit(10);
      
      if (targetEmpresas.length > 0) {
        contactE164Query = contactE164Query.in('empresa', targetEmpresas);
      }
      
      const { data: contactMatches } = await contactE164Query;
      
      if (contactMatches && contactMatches.length > 0) {
        crmContact = contactMatches[0] as CrmContact;
        log.info('Match via contacts CRM (telefone_e164)', { contactId: crmContact.id, empresa: crmContact.empresa });
      }
      
      // 2. Fallback: buscar pelo campo telefone raw
      if (!crmContact) {
        const phonesToTry = [...new Set([rawDigits, phoneNormalized, e164])];
        for (const phone of phonesToTry) {
          let rawQuery = supabase
            .from('contacts')
            .select('id, legacy_lead_id, empresa, nome, telefone, telefone_e164')
            .eq('telefone', phone)
            .order('updated_at', { ascending: false })
            .limit(10);
          
          if (targetEmpresas.length > 0) {
            rawQuery = rawQuery.in('empresa', targetEmpresas);
          }
          
          const { data: rawMatches } = await rawQuery;
          
          if (rawMatches && rawMatches.length > 0) {
            crmContact = rawMatches[0] as CrmContact;
            log.info('Match via contacts CRM (telefone raw)', { contactId: crmContact.id, telefone: phone, empresa: crmContact.empresa });
            break;
          }
        }
      }
      
      // 3. Fallback: últimos 8 dígitos
      if (!crmContact) {
        const last8 = phoneNormalized.slice(-8);
        let partialCrmQuery = supabase
          .from('contacts')
          .select('id, legacy_lead_id, empresa, nome, telefone, telefone_e164')
          .or(`telefone_e164.like.%${last8},telefone.like.%${last8}`)
          .order('updated_at', { ascending: false })
          .limit(10);
        
        if (targetEmpresas.length > 0) {
          partialCrmQuery = partialCrmQuery.in('empresa', targetEmpresas);
        }
        
        const { data: partialContacts } = await partialCrmQuery;
        
        if (partialContacts && partialContacts.length > 0) {
          crmContact = partialContacts[0] as CrmContact;
          log.info('Match parcial via contacts CRM', { contactId: crmContact.id, empresa: crmContact.empresa });
        }
      }
    }

    const matchedEmpresa = leadContact?.empresa || crmContact?.empresa;
    const finalLeadContact = leadContact;
    const finalCrmContact = crmContact;
    
    if (matchedEmpresa) {
      log.info('Empresa do lead/contact encontrada', { empresa: matchedEmpresa });
    } else {
      log.info('Nenhum lead/contact encontrado, usando empresa-alvo do webhook', { targetEmpresa });
    }
    
    let activeRun: LeadCadenceRun | null = null;
    if (finalLeadContact) {
      activeRun = await findActiveRun(supabase, finalLeadContact.lead_id, finalLeadContact.empresa);
    }
    
    // EMPRESA-FIRST: passa targetEmpresa como fallback para garantir empresa correta em UNMATCHED
    const result = await saveInboundMessage(
      supabase, payload, finalLeadContact, activeRun, 
      finalCrmContact?.id, finalCrmContact?.empresa,
      targetEmpresa
    );
    
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
