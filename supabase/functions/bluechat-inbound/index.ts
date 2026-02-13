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
  ticket_id?: string;            // ID do ticket no Blue Chat (para callbacks)
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

// ========================================
// PARSER DE RESUMO DE TRIAGEM [NOVO ATENDIMENTO]
// ========================================

interface TriageSummary {
  clienteNome: string | null;
  telefone: string | null;
  email: string | null;
  resumoTriagem: string | null;
  historico: string | null;
  rawSummary: string;
}

/**
 * Detecta e parseia o formato [NOVO ATENDIMENTO] enviado pela triagem (MarIA)
 * Retorna null se a mensagem não é um resumo de triagem
 */
function parseTriageSummary(text: string): TriageSummary | null {
  if (!text.includes('[NOVO ATENDIMENTO]')) return null;

  console.log('[Triage] Resumo de triagem detectado');

  let clienteNome: string | null = null;
  let telefone: string | null = null;
  let email: string | null = null;
  let resumoTriagem: string | null = null;
  let historico: string | null = null;

  // Extrair nome do cliente
  const nomeMatch = text.match(/Cliente:\s*(.+)/i);
  if (nomeMatch) clienteNome = nomeMatch[1].trim();

  // Extrair telefone
  const telMatch = text.match(/Telefone:\s*(\+?\d[\d\s\-]+)/i);
  if (telMatch) telefone = telMatch[1].replace(/[\s\-]/g, '').trim();

  // Extrair email
  const emailMatch = text.match(/Email:\s*(\S+@\S+)/i);
  if (emailMatch) email = emailMatch[1].trim();

  // Extrair resumo da triagem
  const resumoMatch = text.match(/Resumo da conversa anterior[^:]*:\s*([\s\S]*?)(?=Historico:|Histórico:|$)/i);
  if (resumoMatch) resumoTriagem = resumoMatch[1].trim();

  // Extrair histórico
  const histMatch = text.match(/Histori[cç]o:\s*([\s\S]*?)(?=Inicie o atendimento|$)/i);
  if (histMatch) historico = histMatch[1].trim();

  console.log('[Triage] Dados extraídos:', {
    clienteNome,
    telefone,
    email: email ? '***' : null,
    temResumo: !!resumoTriagem,
    temHistorico: !!historico,
  });

  return {
    clienteNome,
    telefone,
    email,
    resumoTriagem,
    historico,
    rawSummary: text,
  };
}

/**
 * Atualiza dados do lead_contacts com informações extraídas da triagem
 */
async function enrichLeadFromTriage(
  supabase: SupabaseClient,
  leadContact: LeadContact,
  triage: TriageSummary
): Promise<void> {
  const updates: Record<string, unknown> = {};

  // Atualizar nome se não tinha
  if (triage.clienteNome && !leadContact.nome) {
    updates.nome = triage.clienteNome;
    updates.primeiro_nome = extractFirstName(triage.clienteNome);
  }

  // Atualizar email se não tinha
  if (triage.email && !leadContact.email) {
    updates.email = triage.email;
  }

  if (Object.keys(updates).length > 0) {
    console.log('[Triage] Enriquecendo lead com dados da triagem:', updates);
    await supabase
      .from('lead_contacts')
      .update(updates)
      .eq('id', leadContact.id);
  }
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
  action: 'RESPOND' | 'ESCALATE' | 'QUALIFY_ONLY' | 'RESOLVE';
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
    department?: string;
  };
  resolution?: {
    summary: string;
    reason: string;
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
 * Valida autenticação do webhook e retorna a empresa associada à chave
 */
function validateAuth(req: Request): { valid: boolean; empresaFromKey?: EmpresaTipo } {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');
  
  const bluechatApiKeyTokeniza = Deno.env.get('BLUECHAT_API_KEY');
  const bluechatApiKeyBlue = Deno.env.get('BLUECHAT_API_KEY_BLUE');
  
  if (!bluechatApiKeyTokeniza && !bluechatApiKeyBlue) {
    console.error('[Auth] Nenhuma BLUECHAT_API_KEY configurada');
    return { valid: false };
  }
  
  const token = authHeader ? authHeader.replace('Bearer ', '') : apiKeyHeader;
  
  // DEBUG temporário - remover após resolver autenticação
  console.log('[Auth DEBUG] Headers recebidos:', {
    hasAuth: !!authHeader,
    hasApiKey: !!apiKeyHeader,
    tokenPreview: token ? `${token.substring(0, 8)}...${token.substring(token.length - 4)}` : 'NENHUM',
    tokenLength: token?.length || 0,
    tokenizaKeyPreview: bluechatApiKeyTokeniza ? `${bluechatApiKeyTokeniza.substring(0, 8)}...` : 'NÃO CONFIGURADO',
    tokenizaKeyLength: bluechatApiKeyTokeniza?.length || 0,
    blueKeyPreview: bluechatApiKeyBlue ? `${bluechatApiKeyBlue.substring(0, 8)}...` : 'NÃO CONFIGURADO',
    blueKeyLength: bluechatApiKeyBlue?.length || 0,
  });
  
  if (token && bluechatApiKeyTokeniza && token.trim() === bluechatApiKeyTokeniza.trim()) {
    return { valid: true, empresaFromKey: 'TOKENIZA' };
  }
  
  if (token && bluechatApiKeyBlue && token.trim() === bluechatApiKeyBlue.trim()) {
    return { valid: true, empresaFromKey: 'BLUE' };
  }
  
  console.warn('[Auth] Token inválido para Blue Chat');
  return { valid: false };
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
    prioridade: 2,
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
  activeRun: LeadCadenceRun | null,
  empresaContexto: EmpresaTipo
): Promise<{ messageId: string } | null> {
  // Verificar duplicata
  if (await isDuplicate(supabase, payload.message_id)) {
    console.log('[Inbound] Mensagem duplicada:', payload.message_id);
    return null;
  }
  
  // IMPORTANTE: Usa empresaContexto (do payload) em vez de leadContact.empresa
  // para garantir isolamento de contexto entre empresas
  const messageRecord = {
    lead_id: leadContact.lead_id,
    empresa: empresaContexto,
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
  messageId: string,
  triageSummary?: TriageSummary | null
): Promise<{
  intent: string;
  confidence: number;
  leadReady: boolean;
  responseText?: string;
  escalation?: { needed: boolean; reason?: string; priority?: string };
  departamento_destino?: string | null;
} | null> {
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 2000;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      console.log(`[SDR IA] Chamando interpretação (tentativa ${attempt + 1}/${MAX_RETRIES + 1}):`, messageId, triageSummary ? '(com resumo triagem)' : '');
      
      const requestBody: Record<string, unknown> = { 
        messageId, 
        source: 'BLUECHAT', 
        mode: 'PASSIVE_CHAT' 
      };
      
      // Incluir resumo de triagem se disponível
      if (triageSummary) {
        requestBody.triageSummary = {
          clienteNome: triageSummary.clienteNome,
          email: triageSummary.email,
          resumoTriagem: triageSummary.resumoTriagem,
          historico: triageSummary.historico,
        };
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/sdr-ia-interpret`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify(requestBody),
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
          departamento_destino: result.departamento_destino || null,
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

/**
 * Envia resposta de volta ao Blue Chat via API (callback assíncrono)
 */
async function sendResponseToBluechat(
  supabase: SupabaseClient,
  data: {
    conversation_id: string;
    ticket_id?: string;
    message_id: string;
    text: string;
    action: string;
    resolution?: { summary: string; reason: string };
    empresa: EmpresaTipo;
    department?: string | null;
  }
): Promise<void> {
  try {
    // Buscar URL da API do Blue Chat por empresa em system_settings
    const settingsKey = data.empresa === 'BLUE' ? 'bluechat_blue' : 'bluechat_tokeniza';
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'integrations')
      .eq('key', settingsKey)
      .maybeSingle();

    // Fallback para config legada 'bluechat' se não encontrar config por empresa
    let apiUrl = (setting?.value as Record<string, unknown>)?.api_url as string | undefined;
    if (!apiUrl) {
      const { data: legacySetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('category', 'integrations')
        .eq('key', 'bluechat')
        .maybeSingle();
      apiUrl = (legacySetting?.value as Record<string, unknown>)?.api_url as string | undefined;
    }
    
    if (!apiUrl) {
      console.warn(`[Callback] URL da API Blue Chat não configurada para ${data.empresa}`);
      return;
    }

    // Usar API key correta por empresa
    const bluechatApiKey = data.empresa === 'BLUE' 
      ? Deno.env.get('BLUECHAT_API_KEY_BLUE') 
      : Deno.env.get('BLUECHAT_API_KEY');
    if (!bluechatApiKey) {
      console.warn(`[Callback] BLUECHAT_API_KEY não configurada para ${data.empresa}`);
      return;
    }

    const baseUrl = apiUrl.replace(/\/$/, '');
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': bluechatApiKey,
    };

    // 1. Enviar mensagem de resposta via POST /messages
    const messagesUrl = `${baseUrl}/messages`;
    console.log('[Callback] Enviando mensagem para Blue Chat:', messagesUrl);

    const msgResponse = await fetch(messagesUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        conversation_id: data.conversation_id,
        content: data.text,
        source: 'AMELIA_SDR',
      }),
    });

    if (!msgResponse.ok) {
      console.error('[Callback] Erro ao enviar mensagem:', msgResponse.status, await msgResponse.text().catch(() => ''));
    } else {
      console.log('[Callback] Mensagem enviada ao Blue Chat com sucesso');
    }

    // 2. Se ação é ESCALATE, transferir o ticket para humano
    if (data.action === 'ESCALATE' && data.ticket_id) {
      const transferUrl = `${baseUrl}/tickets/${data.ticket_id}/transfer`;
      console.log('[Callback] Transferindo ticket:', transferUrl, '| Departamento:', data.department || 'Comercial');

      const transferResponse = await fetch(transferUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reason: 'Lead qualificado - escalar para closer',
          source: 'AMELIA_SDR',
          department: data.department || 'Comercial',
        }),
      });

      if (!transferResponse.ok) {
        console.error('[Callback] Erro ao transferir ticket:', transferResponse.status);
      } else {
        console.log('[Callback] Ticket transferido com sucesso para departamento:', data.department || 'Comercial');
      }
    }

    // 3. Se ação é RESOLVE, resolver o ticket no Blue Chat
    if (data.action === 'RESOLVE' && data.ticket_id && data.resolution) {
      const resolveUrl = `${baseUrl}/tickets/${data.ticket_id}/resolve`;
      console.log('[Callback] Resolvendo ticket:', resolveUrl);

      const resolveResponse = await fetch(resolveUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          summary: data.resolution.summary,
          reason: data.resolution.reason,
          source: 'AMELIA_SDR',
        }),
      });

      if (!resolveResponse.ok) {
        console.error('[Callback] Erro ao resolver ticket:', resolveResponse.status);
      } else {
        console.log('[Callback] Ticket resolvido com sucesso');
      }
    }
  } catch (error) {
    // Não bloqueia o fluxo principal
    console.error('[Callback] Erro ao enviar callback:', error instanceof Error ? error.message : error);
  }
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
    const authResult = validateAuth(req);
    if (!authResult.valid) {
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
      ticket_id: payload.ticket_id,
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
    // Determinar empresa: priorizar payload, fallback pela API key usada
    const empresa: EmpresaTipo = payload.context?.empresa || authResult.empresaFromKey || 'BLUE';
    console.log('[BlueChat] Empresa determinada:', empresa, '(payload:', payload.context?.empresa, '| key:', authResult.empresaFromKey, ')');

    // Verificar se bluechat está habilitado para esta empresa
    const { data: channelConfig } = await supabase
      .from('integration_company_config')
      .select('enabled')
      .eq('empresa', empresa)
      .eq('channel', 'bluechat')
      .maybeSingle();

    if (!channelConfig?.enabled) {
      console.log(`[BlueChat] Canal bluechat desabilitado para empresa ${empresa}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Blue Chat não está habilitado para ${empresa}`,
          conversation_id: payload.conversation_id,
          action: 'ESCALATE',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // FASE 4: Deduplicação por conteúdo (mesma mensagem do mesmo telefone nos últimos 30s)
    {
      const thirtySecsAgo = new Date(Date.now() - 30000).toISOString();
      const { data: recentDup } = await supabase
        .from('lead_messages')
        .select('id')
        .eq('conteudo', payload.message.text)
        .gte('created_at', thirtySecsAgo)
        .limit(1)
        .maybeSingle();
      
      if (recentDup) {
        console.log('[FASE4] Mensagem duplicada detectada (mesmo conteúdo em <30s), ignorando');
        return new Response(
          JSON.stringify({
            success: true,
            conversation_id: payload.conversation_id,
            action: 'QUALIFY_ONLY',
            deduplicated: true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

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
    
    // Se lead foi encontrado em empresa diferente, criar lead_contacts espelho
    if (leadContact.empresa !== empresa) {
      console.warn('[BlueChat] ⚠️ Lead encontrado em outra empresa, criando registro espelho:', {
        leadEmpresa: leadContact.empresa,
        payloadEmpresa: empresa,
        leadId: leadContact.lead_id,
      });

      // Verificar se já existe lead_contacts para esta empresa
      const { data: existingContact } = await supabase
        .from('lead_contacts')
        .select('id')
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa)
        .maybeSingle();

      if (!existingContact) {
        // Criar lead_contacts espelho na empresa do contexto atual
        const mirrorContact = {
          id: crypto.randomUUID(),
          lead_id: leadContact.lead_id,
          empresa,
          nome: leadContact.nome || payload.contact.name || null,
          primeiro_nome: extractFirstName(leadContact.nome || payload.contact.name),
          email: leadContact.email || payload.contact.email || null,
          telefone: leadContact.telefone,
          telefone_e164: leadContact.telefone_e164,
          telefone_valido: true,
          ddi: '55',
          origem_telefone: 'BLUECHAT',
          opt_out: false,
          pessoa_id: (leadContact as Record<string, unknown>).pessoa_id as string | null || null,
        };

        const { data: newContact, error: mirrorErr } = await supabase
          .from('lead_contacts')
          .insert(mirrorContact)
          .select()
          .single();

        if (mirrorErr) {
          console.error('[BlueChat] Erro ao criar lead_contacts espelho:', mirrorErr);
        } else {
          console.log('[BlueChat] Lead_contacts espelho criado para', empresa);
          // Usar o novo contact como referência
          leadContact = newContact as LeadContact;
        }

        // Criar classificação inicial para a nova empresa
        await supabase.from('lead_classifications').insert({
          lead_id: leadContact.lead_id,
          empresa,
          icp: empresa === 'BLUE' ? 'BLUE_NAO_CLASSIFICADO' : 'TOKENIZA_NAO_CLASSIFICADO',
          temperatura: 'MORNO',
          prioridade: 2,
          origem: 'AUTOMATICA',
        });
      } else {
        // Já existe, buscar o contact da empresa correta
        const { data: correctContact } = await supabase
          .from('lead_contacts')
          .select('*')
          .eq('lead_id', leadContact.lead_id)
          .eq('empresa', empresa)
          .single();
        if (correctContact) {
          leadContact = correctContact as LeadContact;
        }
      }
    }
    
    // 3. Detectar resumo de triagem [NOVO ATENDIMENTO]
    const triageSummary = parseTriageSummary(payload.message.text);
    
    // FASE 5: Verificar se é lead retornando (interação recente < 2h)
    let isReturningLead = false;
    if (triageSummary) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: recentInteraction } = await supabase
        .from('lead_messages')
        .select('id')
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa)
        .gte('created_at', twoHoursAgo)
        .limit(1)
        .maybeSingle();
      
      if (recentInteraction) {
        isReturningLead = true;
        console.log('[FASE5] Lead retornando detectado (interação < 2h), tratando como continuação');
      }
    }
    
    // 3.1 Se é resumo de triagem, enriquecer lead com dados extraídos
    if (triageSummary && !isReturningLead) {
      console.log('[BlueChat] Resumo de triagem detectado para lead:', leadContact.lead_id);
      await enrichLeadFromTriage(supabase, leadContact, triageSummary);
      
      // MUDANÇA 1: Reset de estado ESCALAR_IMEDIATO no [NOVO ATENDIMENTO]
      try {
        const { data: convStateForReset } = await supabase
          .from('lead_conversation_state')
          .select('ultima_pergunta_id, estado_funil, framework_data')
          .eq('lead_id', leadContact.lead_id)
          .eq('empresa', empresa)
          .maybeSingle();
        
        if (convStateForReset) {
          const needsReset = 
            convStateForReset.ultima_pergunta_id === 'ESCALAR_IMEDIATO' ||
            convStateForReset.estado_funil === 'ESCALAR_IMEDIATO' ||
            ['POS_VENDA', 'FECHAMENTO'].includes(convStateForReset.estado_funil || '');
          
          if (needsReset) {
            const fwData = (convStateForReset.framework_data as Record<string, unknown>) || {};
            await supabase
              .from('lead_conversation_state')
              .update({
                ultima_pergunta_id: 'NENHUMA',
                estado_funil: 'DIAGNOSTICO',
                framework_data: { ...fwData, ia_null_count: 0, ticket_resolved: false },
                updated_at: new Date().toISOString(),
              })
              .eq('lead_id', leadContact.lead_id)
              .eq('empresa', empresa);
            console.log('[Triage] Estado ESCALAR_IMEDIATO/terminal resetado para novo atendimento');
          }
        }
      } catch (resetErr) {
        console.error('[Triage] Erro ao resetar estado:', resetErr);
      }
    } else if (triageSummary && isReturningLead) {
      console.log('[BlueChat] Lead retornando - NÃO tratando como novo atendimento');
    }
    
    // 4. Modo passivo: NÃO buscar cadência ativa (Amélia é atendente passiva no Blue Chat)
    // A Amélia não se vincula a cadências quando opera via Blue Chat
    const activeRun = null;
    
    // 5. Salvar mensagem (sem cadência vinculada)
    // Passa 'empresa' do payload para garantir isolamento de contexto
    const savedMessage = await saveInboundMessage(supabase, payload, leadContact, activeRun, empresa);
    
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
    
    // 6. Chamar SDR IA para interpretar (passando resumo de triagem se houver)
    const iaResult = await callSdrIaInterpret(savedMessage.messageId, triageSummary);
    
    // 6. Detectar intenção de encerramento da conversa
    const closingKeywords = ['obrigado', 'obrigada', 'valeu', 'até mais', 'tchau', 'era isso', 'resolvido', 'era só isso', 'muito obrigado', 'muito obrigada', 'falou', 'flw', 'vlw', 'brigado', 'brigada'];
    const closingIntents = ['AGRADECIMENTO', 'CUMPRIMENTO'];
    const messageText = payload.message.text.toLowerCase().trim();
    
    const isClosingIntent = closingIntents.includes(iaResult?.intent || '');
    const hasClosingKeyword = closingKeywords.some(kw => messageText.includes(kw));
    
    // MUDANÇA 3: Proteção contra agradecimento à MarIA
    // Se triageSummary detectado ou Amélia tem < 3 mensagens OUTBOUND, NÃO tratar como encerramento
    let ameliaOutboundCount = 0;
    if (isClosingIntent || hasClosingKeyword) {
      const { count } = await supabase
        .from('lead_messages')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa)
        .eq('direcao', 'OUTBOUND')
        .eq('sender_type', 'AMELIA');
      ameliaOutboundCount = count || 0;
    }
    
    const isThankingMarIA = (triageSummary || ameliaOutboundCount < 3) && (isClosingIntent || hasClosingKeyword);
    if (isThankingMarIA) {
      console.log('[BlueChat] 🛡️ Agradecimento detectado mas Amélia tem <3 OUTBOUND ou triageSummary presente → NÃO tratando como encerramento');
    }
    
    // Verificar estado do funil para contexto de encerramento
    let funnelClosing = false;
    if (iaResult && (isClosingIntent || hasClosingKeyword) && !isThankingMarIA) {
      const { data: convState } = await supabase
        .from('lead_conversation_state')
        .select('estado_funil')
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa)
        .maybeSingle();
      
      funnelClosing = ['POS_VENDA', 'FECHAMENTO'].includes(convState?.estado_funil || '');
    }
    
    // Decidir se é encerramento: intent de despedida + (keyword OU funil avançado) + NÃO é agradecimento à MarIA
    const isConversationEnding = !isThankingMarIA && isClosingIntent && (hasClosingKeyword || funnelClosing);
    
    // Gerar resolution se for encerramento
    let resolution: { summary: string; reason: string } | undefined;
    if (isConversationEnding) {
      const leadName = leadContact.nome || payload.contact.name || 'Lead';
      resolution = {
        summary: `Atendimento de ${leadName} (${empresa}) concluído. Intent: ${iaResult?.intent || 'N/A'}. Qualificação via Amélia SDR.`,
        reason: `Lead encerrou a conversa (${iaResult?.intent || 'despedida'}). Palavra-chave detectada na mensagem.`,
      };
      console.log('[BlueChat] 🔚 Encerramento detectado:', resolution);
    }
    
    // 7. PATCH ANTI-LIMBO: Determinar ação e mensagem, nunca deixar no limbo
    let action: BlueChatResponse['action'];
    let responseText: string | null = iaResult?.responseText || null;
    // Departamento destino: vem da IA ou fallback "Comercial"
    let departamentoDestino: string = iaResult?.departamento_destino || 'Comercial';

    // ANTI-LIMBO: Se IA retornou null (falha total), perguntar antes de escalar
    if (!iaResult) {
      // Buscar contador de falhas consecutivas do framework_data
      const { data: stateForNull } = await supabase
        .from('lead_conversation_state')
        .select('framework_data')
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa)
        .maybeSingle();
      
      const fwData = (stateForNull?.framework_data as Record<string, unknown>) || {};
      const iaNullCount = (typeof fwData.ia_null_count === 'number' ? fwData.ia_null_count : 0) + 1;
      
      if (iaNullCount >= 3) {
        // 3a falha consecutiva: agora sim escalar
        action = 'ESCALATE';
        responseText = 'Vou te conectar com alguém da equipe que pode te ajudar melhor com isso!';
        departamentoDestino = 'Comercial';
        console.log(`[BlueChat] ⚠️ IA null ${iaNullCount}x consecutivas → ESCALATE → Comercial`);
        // Resetar contador
        await supabase
          .from('lead_conversation_state')
          .update({ framework_data: { ...fwData, ia_null_count: 0 } })
          .eq('lead_id', leadContact.lead_id)
          .eq('empresa', empresa);
      } else {
        // 1a ou 2a falha: perguntar em vez de escalar
        action = 'RESPOND';
        responseText = 'Desculpa, pode repetir ou dar mais detalhes? Quero entender direitinho pra te ajudar!';
        console.log(`[BlueChat] 🔄 IA null (${iaNullCount}/3) → pergunta de continuidade`);
        // Incrementar contador
        await supabase
          .from('lead_conversation_state')
          .update({ framework_data: { ...fwData, ia_null_count: iaNullCount } })
          .eq('lead_id', leadContact.lead_id)
          .eq('empresa', empresa);
      }
    } else if (isConversationEnding) {
      // IA respondeu com sucesso: resetar contador de falhas se existir
      try {
        const { data: stateForReset } = await supabase
          .from('lead_conversation_state')
          .select('framework_data')
          .eq('lead_id', leadContact.lead_id)
          .eq('empresa', empresa)
          .maybeSingle();
        const fwReset = (stateForReset?.framework_data as Record<string, unknown>) || {};
        if (fwReset.ia_null_count && (fwReset.ia_null_count as number) > 0) {
          await supabase
            .from('lead_conversation_state')
            .update({ framework_data: { ...fwReset, ia_null_count: 0 } })
            .eq('lead_id', leadContact.lead_id)
            .eq('empresa', empresa);
        }
      } catch (_) { /* non-critical */ }
      action = 'RESOLVE';
    } else if (iaResult.escalation?.needed) {
      action = 'ESCALATE';
      // Se escalação necessária mas sem texto, usar mensagem padrão
      if (!responseText) {
        responseText = 'Vou te conectar com alguém da equipe que pode te ajudar melhor com isso!';
        console.log('[BlueChat] 🔄 ESCALATE sem responseText → mensagem padrão');
      }
    } else if (responseText) {
      action = 'RESPOND';
      // IA respondeu com sucesso: resetar contador de falhas
      try {
        const { data: stateForReset2 } = await supabase
          .from('lead_conversation_state')
          .select('framework_data')
          .eq('lead_id', leadContact.lead_id)
          .eq('empresa', empresa)
          .maybeSingle();
        const fwReset2 = (stateForReset2?.framework_data as Record<string, unknown>) || {};
        if (fwReset2.ia_null_count && (fwReset2.ia_null_count as number) > 0) {
          await supabase
            .from('lead_conversation_state')
            .update({ framework_data: { ...fwReset2, ia_null_count: 0 } })
            .eq('lead_id', leadContact.lead_id)
            .eq('empresa', empresa);
        }
      } catch (_) { /* non-critical */ }
    } else {
      // ANTI-LIMBO: IA respondeu mas sem texto
      const { count: msgCount } = await supabase
        .from('lead_messages')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa);
      
      if ((msgCount || 0) <= 2) {
        // Pouco contexto: perguntar o que o lead precisa
        action = 'RESPOND';
        responseText = 'Oi! Sou a Amélia, do comercial do Grupo Blue. Em que posso te ajudar?';
        console.log('[BlueChat] 🔄 Sem resposta IA + pouco contexto → pergunta de contexto');
      } else if ((msgCount || 0) > 15) {
        // Muitas mensagens sem resposta: loop real, escalar
        action = 'ESCALATE';
        departamentoDestino = 'Comercial';
        responseText = 'Vou te conectar com alguém da equipe que pode te ajudar melhor com isso!';
        console.log('[BlueChat] 🔄 Sem resposta IA + >15 msgs → ESCALATE (loop detectado)');
      } else {
        // 2-15 mensagens: perguntar mais detalhes em vez de escalar
        action = 'RESPOND';
        responseText = 'Me conta mais sobre o que você precisa? Quero entender melhor pra te direcionar certo!';
        console.log('[BlueChat] 🔄 Sem resposta IA + contexto médio → pergunta de continuidade');
      }
    }
    
    const response: BlueChatResponse = {
      success: true,
      conversation_id: payload.conversation_id,
      message_id: savedMessage.messageId,
      lead_id: leadContact.lead_id,
      action,
      intent: {
        detected: iaResult?.intent || 'OUTRO',
        confidence: iaResult?.confidence || 0.5,
        lead_ready: iaResult?.leadReady || false,
      },
      escalation: {
        needed: action === 'ESCALATE',
        reason: iaResult?.escalation?.reason || (action === 'ESCALATE' ? 'Escalação automática anti-limbo' : undefined),
        priority: (iaResult?.escalation?.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') || (action === 'ESCALATE' ? 'MEDIUM' : undefined),
        department: action === 'ESCALATE' ? departamentoDestino : undefined,
      },
    };
    
    // Adicionar resolution se for encerramento
    if (resolution) {
      response.resolution = resolution;
    }
    
    // Adicionar resposta ao response
    if (responseText) {
      response.response = {
        text: responseText,
        suggested_next: isConversationEnding 
          ? 'Conversa encerrada - ticket resolvido'
          : action === 'ESCALATE'
            ? 'Ticket transferido para atendimento humano'
            : iaResult?.leadReady 
              ? 'Lead pronto para closer - agendar reunião' 
              : 'Continuar qualificação',
      };
    }
    
    // 7.5. Persistir conversation_id do Blue Chat no lead_conversation_state
    // para que whatsapp-send possa usá-lo ao enviar mensagens manuais
    try {
      const { data: existingState } = await supabase
        .from('lead_conversation_state')
        .select('framework_data')
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa)
        .maybeSingle();

      const currentFrameworkData = (existingState?.framework_data as Record<string, unknown>) || {};
      const updatedFrameworkData = {
        ...currentFrameworkData,
        bluechat_conversation_id: payload.conversation_id,
        bluechat_ticket_id: payload.ticket_id || null,
      };

      await supabase
        .from('lead_conversation_state')
        .upsert({
          lead_id: leadContact.lead_id,
          empresa: empresa,
          framework_data: updatedFrameworkData,
          ultimo_contato_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'lead_id,empresa' });

      console.log('[BlueChat] conversation_id salvo no framework_data:', payload.conversation_id);
    } catch (err) {
      console.error('[BlueChat] Erro ao salvar conversation_id:', err);
    }

    // 8. Persistir mensagem OUTBOUND da Amélia no banco (SEMPRE que houver texto)
    if (responseText) {
      try {
        const { data: outboundMsg, error: outboundError } = await supabase
          .from('lead_messages')
          .insert({
            lead_id: leadContact.lead_id,
            empresa: empresa,
            canal: payload.channel === 'EMAIL' ? 'EMAIL' : 'WHATSAPP',
            direcao: 'OUTBOUND',
            conteudo: responseText,
            estado: 'ENVIADO',
            template_codigo: 'BLUECHAT_PASSIVE_REPLY',
            enviado_em: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (outboundError) {
          console.error('[Outbound] Erro ao persistir mensagem OUTBOUND:', outboundError);
        } else {
          console.log('[Outbound] Mensagem OUTBOUND persistida:', (outboundMsg as { id: string }).id);
        }
      } catch (err) {
        console.error('[Outbound] Erro inesperado ao persistir:', err);
      }
    }

    // MUDANÇA 4: Verificar ticket resolvido antes de enviar callback
    // Se ticket já foi resolvido (flag ticket_resolved em framework_data), Amélia fica muda
    let ticketAlreadyResolved = false;
    try {
      const { data: stateForTicket } = await supabase
        .from('lead_conversation_state')
        .select('framework_data')
        .eq('lead_id', leadContact.lead_id)
        .eq('empresa', empresa)
        .maybeSingle();
      const fwTicket = (stateForTicket?.framework_data as Record<string, unknown>) || {};
      ticketAlreadyResolved = fwTicket.ticket_resolved === true;
    } catch (_) { /* non-critical */ }
    
    if (ticketAlreadyResolved) {
      console.log('[BlueChat] 🔇 Ticket já resolvido, Amélia ficando muda');
      response.action = 'QUALIFY_ONLY';
    }

    // 9. Callback: enviar resposta/escalação de volta ao Blue Chat via API (SEMPRE que houver texto)
    if (responseText && !ticketAlreadyResolved) {
      await sendResponseToBluechat(supabase, {
        conversation_id: payload.conversation_id,
        ticket_id: payload.ticket_id,
        message_id: savedMessage.messageId,
        text: responseText,
        action: response.action,
        resolution,
        empresa,
        department: action === 'ESCALATE' ? departamentoDestino : undefined,
      });
      
      // Se ação é RESOLVE, marcar ticket_resolved no framework_data
      if (response.action === 'RESOLVE') {
        try {
          const { data: stateForResolve } = await supabase
            .from('lead_conversation_state')
            .select('framework_data')
            .eq('lead_id', leadContact.lead_id)
            .eq('empresa', empresa)
            .maybeSingle();
          const fwResolve = (stateForResolve?.framework_data as Record<string, unknown>) || {};
          await supabase
            .from('lead_conversation_state')
            .update({ framework_data: { ...fwResolve, ticket_resolved: true } })
            .eq('lead_id', leadContact.lead_id)
            .eq('empresa', empresa);
          console.log('[BlueChat] ✅ Flag ticket_resolved setada');
        } catch (_) { /* non-critical */ }
      }
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
