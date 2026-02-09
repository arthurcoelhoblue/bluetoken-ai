import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// PATCH Blue Chat Inbound Webhook
// Integração Blue Chat → Amélia (SDR IA)
// ========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// ========================================
// TIPOS
// ========================================
type EmpresaTipo = 'TOKENIZA' | 'BLUE';
type ChannelType = 'WHATSAPP' | 'EMAIL' | 'SMS';

interface BlueChatPayload {
  conversation_id: string;       // ID da conversa no Blue Chat
  message_id: string;            // ID da mensagem
  timestamp: string;             // ISO timestamp
  channel: ChannelType;          // Canal de origem
  contact: {
    phone: string;               // +5561998317422
    name?: string;               // Nome do contato
    email?: string;              // Email opcional
  };
  message: {
    type: 'text' | 'audio' | 'image' | 'document';
    text: string;                // Conteúdo textual
    media_url?: string;          // URL da mídia se houver
  };
  context?: {
    empresa?: EmpresaTipo;       // TOKENIZA ou BLUE (default: BLUE)
    agent_id?: string;           // Qual agente (amelia, etc)
    tags?: string[];             // Tags do Blue Chat
    history_summary?: string;    // Resumo do histórico
  };
}

interface LeadContact {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  nome: string | null;
  telefone: string | null;
  telefone_e164: string | null;
  email: string | null;
}

interface LeadCadenceRun {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  status: string;
}

interface BlueChatResponse {
  success: boolean;
  conversation_id: string;
  message_id?: string;
  lead_id?: string | null;
  action: 'RESPOND' | 'ESCALATE' | 'QUALIFY_ONLY';
  response?: {
    text: string;
    suggested_next?: string;
  };
  intent?: {
    detected: string;
    confidence: number;
    lead_ready: boolean;
  };
  escalation?: {
    needed: boolean;
    reason?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  };
  error?: string;
}

// ========================================
// UTILITÁRIOS
// ========================================

/**
 * Normaliza número de telefone para formato E.164
 */
function normalizePhone(raw: string): { normalized: string; e164: string } {
  let normalized = raw.replace(/\D/g, '');
  
  // Se tiver 11 dígitos (sem DDI), adiciona 55
  if (normalized.length === 11) {
    normalized = '55' + normalized;
  }
  
  const e164 = normalized.startsWith('+') ? normalized : `+${normalized}`;
  
  return { normalized, e164 };
}

/**
 * Valida autenticação do webhook
 */
function validateAuth(req: Request): boolean {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');
  
  // Usa mesmo secret que o whatsapp-inbound para simplificar
  const inboundSecret = Deno.env.get('WHATSAPP_INBOUND_SECRET');
  
  if (!inboundSecret) {
    console.error('[Auth] WHATSAPP_INBOUND_SECRET não configurado');
    return false;
  }
  
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token === inboundSecret) return true;
  }
  
  if (apiKeyHeader === inboundSecret) return true;
  
  console.warn('[Auth] Token inválido');
  return false;
}

/**
 * Extrai primeiro nome do nome completo
 */
function extractFirstName(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const parts = fullName.trim().split(' ');
  return parts[0] || null;
}

/**
 * Gera variações do telefone para busca
 */
function generatePhoneVariations(phone: string): string[] {
  const variations: string[] = [phone];
  
  const withoutDDI = phone.startsWith('55') ? phone.slice(2) : phone;
  const ddd = withoutDDI.slice(0, 2);
  const number = withoutDDI.slice(2);
  
  if (number.length === 8) {
    variations.push(`55${ddd}9${number}`);
    variations.push(`${ddd}9${number}`);
  }
  
  if (number.length === 9 && number.startsWith('9')) {
    variations.push(`55${ddd}${number.slice(1)}`);
    variations.push(`${ddd}${number.slice(1)}`);
  }
  
  variations.push(withoutDDI);
  
  return [...new Set(variations)];
}

/**
 * Busca lead pelo telefone
 */
async function findLeadByPhone(
  supabase: SupabaseClient,
  phoneNormalized: string,
  e164: string,
  empresa: EmpresaTipo
): Promise<LeadContact | null> {
  console.log('[Lead] Buscando por telefone:', phoneNormalized, 'empresa:', empresa);
  
  // 1. Busca por telefone_e164 na empresa específica primeiro
  const { data: e164Match } = await supabase
    .from('lead_contacts')
    .select('*')
    .eq('telefone_e164', e164)
    .eq('empresa', empresa)
    .eq('opt_out', false)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (e164Match) {
    console.log('[Lead] Match por telefone_e164:', (e164Match as LeadContact).lead_id);
    return e164Match as LeadContact;
  }
  
  // 2. Busca em todas as empresas se não encontrar na específica
  const { data: anyMatch } = await supabase
    .from('lead_contacts')
    .select('*')
    .eq('telefone_e164', e164)
    .eq('opt_out', false)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (anyMatch) {
    console.log('[Lead] Match em outra empresa:', (anyMatch as LeadContact).lead_id, '-', (anyMatch as LeadContact).empresa);
    return anyMatch as LeadContact;
  }
  
  // 3. Tenta variações do telefone
  const variations = generatePhoneVariations(phoneNormalized);
  for (const variant of variations) {
    const { data: match } = await supabase
      .from('lead_contacts')
      .select('*')
      .eq('telefone', variant)
      .eq('opt_out', false)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (match) {
      console.log('[Lead] Match por variação:', (match as LeadContact).lead_id);
      return match as LeadContact;
    }
  }
  
  console.log('[Lead] Nenhum lead encontrado');
  return null;
}

/**
 * Cria um novo lead automaticamente
 */
async function createLead(
  supabase: SupabaseClient,
  payload: BlueChatPayload,
  phoneInfo: { normalized: string; e164: string },
  empresa: EmpresaTipo
): Promise<LeadContact | null> {
  const leadId = crypto.randomUUID();
  
  console.log('[Lead] Criando novo lead:', {
    leadId,
    empresa,
    phone: phoneInfo.e164,
    name: payload.contact.name,
  });
  
  // Extrair DDD e número nacional
  const withoutDDI = phoneInfo.normalized.startsWith('55') 
    ? phoneInfo.normalized.slice(2) 
    : phoneInfo.normalized;
  const ddd = withoutDDI.slice(0, 2);
  const numeroNacional = withoutDDI;
  
  const leadContact = {
    id: crypto.randomUUID(),
    lead_id: leadId,
    empresa,
    nome: payload.contact.name || null,
    primeiro_nome: extractFirstName(payload.contact.name),
    email: payload.contact.email || null,
    telefone: phoneInfo.normalized,
    telefone_e164: phoneInfo.e164,
    telefone_valido: true,
    ddi: '55',
    numero_nacional: numeroNacional,
    origem_telefone: 'BLUECHAT',
    opt_out: false,
  };
  
  const { data, error } = await supabase
    .from('lead_contacts')
    .insert(leadContact)
    .select()
    .single();
    
  if (error) {
    console.error('[Lead] Erro ao criar lead:', error);
    return null;
  }
  
  console.log('[Lead] Lead criado:', (data as LeadContact).lead_id);
  
  // Criar classificação inicial
  await supabase.from('lead_classifications').insert({
    lead_id: leadId,
    empresa,
    icp: empresa === 'BLUE' ? 'BLUE_NAO_CLASSIFICADO' : 'TOKENIZA_NAO_CLASSIFICADO',
    temperatura: 'MORNO',
    prioridade: 5,
    origem: 'AUTOMATICA',
  });
  
  return data as LeadContact;
}

/**
 * Busca run ativa do lead
 */
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
    
  return data as LeadCadenceRun | null;
}

/**
 * Verifica se mensagem já foi processada
 */
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

/**
 * Salva mensagem inbound
 */
async function saveInboundMessage(
  supabase: SupabaseClient,
  payload: BlueChatPayload,
  leadContact: LeadContact,
  activeRun: LeadCadenceRun | null
): Promise<{ messageId: string } | null> {
  // Verificar duplicata
  if (await isDuplicate(supabase, payload.message_id)) {
    console.log('[Inbound] Mensagem duplicada:', payload.message_id);
    return null;
  }
  
  const messageRecord = {
    lead_id: leadContact.lead_id,
    empresa: leadContact.empresa,
    run_id: activeRun?.id || null,
    canal: payload.channel === 'EMAIL' ? 'EMAIL' : 'WHATSAPP',
    direcao: 'INBOUND',
    conteudo: payload.message.text,
    estado: 'RECEBIDO',
    whatsapp_message_id: payload.message_id,
    recebido_em: payload.timestamp,
  };
  
  console.log('[Inbound] Salvando mensagem:', {
    leadId: messageRecord.lead_id,
    runId: messageRecord.run_id,
    canal: messageRecord.canal,
  });
  
  const { data, error } = await supabase
    .from('lead_messages')
    .insert(messageRecord)
    .select('id')
    .single();
    
  if (error) {
    console.error('[Inbound] Erro ao salvar:', error);
    return null;
  }
  
  const savedMessage = { messageId: (data as { id: string }).id };
  console.log('[Inbound] Mensagem salva:', savedMessage.messageId);
  
  // Registrar evento de resposta se tiver run ativa
  if (activeRun) {
    await supabase.from('lead_cadence_events').insert({
      lead_cadence_run_id: activeRun.id,
      step_ordem: 0,
      template_codigo: 'BLUECHAT_INBOUND',
      tipo_evento: 'RESPOSTA_DETECTADA',
      detalhes: {
        message_id: savedMessage.messageId,
        bluechat_message_id: payload.message_id,
        conversation_id: payload.conversation_id,
        preview: payload.message.text.substring(0, 100),
      },
    });
  }
  
  return savedMessage;
}

/**
 * Chama SDR IA para interpretar a mensagem
 */
async function callSdrIaInterpret(
  messageId: string
): Promise<{
  intent: string;
  confidence: number;
  leadReady: boolean;
  responseText?: string;
  escalation?: { needed: boolean; reason?: string; priority?: string };
} | null> {
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 2000;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      console.log(`[SDR IA] Chamando interpretação (tentativa ${attempt + 1}/${MAX_RETRIES + 1}):`, messageId);
      
      const response = await fetch(`${supabaseUrl}/functions/v1/sdr-ia-interpret`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ messageId }),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[SDR IA] Resultado:', result);
        
        return {
          intent: result.intent || 'OUTRO',
          confidence: result.confidence || 0.5,
          leadReady: result.leadReady || false,
          responseText: result.responseText,
          escalation: result.escalation,
        };
      }
      
      console.error(`[SDR IA] Erro (tentativa ${attempt + 1}):`, response.status);
      if (attempt < MAX_RETRIES && [500, 502, 503, 504].includes(response.status)) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      return null;
    } catch (error) {
      console.error(`[SDR IA] Erro ao chamar (tentativa ${attempt + 1}):`, error);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

// ========================================
// Handler Principal
// ========================================
serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Apenas POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validar autenticação
  if (!validateAuth(req)) {
    console.error('[BlueChat] Acesso não autorizado');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const payload: BlueChatPayload = await req.json();
    
    console.log('[BlueChat] Webhook recebido:', {
      conversation_id: payload.conversation_id,
      message_id: payload.message_id,
      channel: payload.channel,
      phone: payload.contact?.phone,
      textPreview: payload.message?.text?.substring(0, 50),
    });

    // Validar campos obrigatórios
    if (!payload.conversation_id || !payload.message_id || !payload.contact?.phone || !payload.message?.text) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          required: ['conversation_id', 'message_id', 'contact.phone', 'message.text']
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const phoneInfo = normalizePhone(payload.contact.phone);
    const empresa: EmpresaTipo = payload.context?.empresa || 'BLUE';
    
    // 1. Buscar lead existente
    let leadContact = await findLeadByPhone(supabase, phoneInfo.normalized, phoneInfo.e164, empresa);
    
    // 2. Criar lead se não existir
    if (!leadContact) {
      console.log('[BlueChat] Lead não encontrado, criando novo...');
      leadContact = await createLead(supabase, payload, phoneInfo, empresa);
      
      if (!leadContact) {
        const errorResponse: BlueChatResponse = {
          success: false,
          conversation_id: payload.conversation_id,
          action: 'ESCALATE',
          escalation: {
            needed: true,
            reason: 'Erro ao criar lead',
            priority: 'HIGH',
          },
          error: 'Failed to create lead',
        };
        
        return new Response(
          JSON.stringify(errorResponse),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // 3. Buscar run ativa
    const activeRun = await findActiveRun(supabase, leadContact.lead_id, leadContact.empresa);
    
    // 4. Salvar mensagem
    const savedMessage = await saveInboundMessage(supabase, payload, leadContact, activeRun);
    
    if (!savedMessage) {
      // Mensagem duplicada
      const duplicateResponse: BlueChatResponse = {
        success: true,
        conversation_id: payload.conversation_id,
        message_id: payload.message_id,
        lead_id: leadContact.lead_id,
        action: 'QUALIFY_ONLY',
        response: {
          text: '',
          suggested_next: 'Mensagem já processada anteriormente',
        },
        intent: {
          detected: 'DUPLICATE',
          confidence: 1,
          lead_ready: false,
        },
        escalation: {
          needed: false,
        },
      };
      
      return new Response(
        JSON.stringify(duplicateResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // 5. Chamar SDR IA para interpretar
    const iaResult = await callSdrIaInterpret(savedMessage.messageId);
    
    // 6. Montar resposta para Blue Chat
    const response: BlueChatResponse = {
      success: true,
      conversation_id: payload.conversation_id,
      message_id: savedMessage.messageId,
      lead_id: leadContact.lead_id,
      action: iaResult?.escalation?.needed ? 'ESCALATE' : (iaResult?.responseText ? 'RESPOND' : 'QUALIFY_ONLY'),
      intent: {
        detected: iaResult?.intent || 'OUTRO',
        confidence: iaResult?.confidence || 0.5,
        lead_ready: iaResult?.leadReady || false,
      },
      escalation: {
        needed: iaResult?.escalation?.needed || false,
        reason: iaResult?.escalation?.reason,
        priority: (iaResult?.escalation?.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') || undefined,
      },
    };
    
    // Adicionar resposta se a IA gerou uma
    if (iaResult?.responseText) {
      response.response = {
        text: iaResult.responseText,
        suggested_next: iaResult.leadReady 
          ? 'Lead pronto para closer - agendar reunião' 
          : 'Continuar qualificação',
      };
    }
    
    console.log('[BlueChat] Resposta:', {
      action: response.action,
      intent: response.intent?.detected,
      leadReady: response.intent?.lead_ready,
      hasResponse: !!response.response?.text,
    });
    
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BlueChat] Erro geral:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
