// ========================================
// WEBHOOK BLUECHAT-INBOUND
// Integração Blue Chat → Amélia (SDR IA)
// ========================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// ========================================
// TIPOS DO PAYLOAD
// ========================================

interface BlueChatPayload {
  // Identificação do lead (pelo menos um obrigatório)
  telefone?: string;           // +5561999999999 ou 5561999999999
  email?: string;              // email do lead
  lead_id?: string;            // UUID do lead se já conhecido
  
  // Mensagem atual
  mensagem: string;            // Texto da mensagem do cliente
  
  // Contexto da conversa (opcional mas recomendado)
  historico?: HistoricoMensagem[];  // Últimas mensagens para contexto
  
  // Metadados do Blue Chat
  bluechat?: {
    ticket_id?: string;        // ID do ticket/conversa no Blue Chat
    agent_id?: string;         // ID do agente que encaminhou (se houver)
    canal_origem?: string;     // 'whatsapp' | 'email' | 'chat' | 'telegram'
    departamento?: string;     // 'comercial' | 'suporte' | 'financeiro'
    prioridade?: 'baixa' | 'normal' | 'alta' | 'urgente';
    tags?: string[];           // Tags associadas ao ticket
  };
  
  // Dados do lead (para criar/atualizar se necessário)
  lead_data?: {
    nome?: string;
    primeiro_nome?: string;
    empresa?: 'TOKENIZA' | 'BLUE';  // Default: BLUE
  };
  
  // Configurações de resposta
  config?: {
    retornar_resposta?: boolean;     // true = retorna resposta da Amélia (default: true)
    criar_lead_se_novo?: boolean;    // true = cria lead se não existir (default: true)
    webhook_resposta?: string;       // URL para enviar resposta async (opcional)
  };
}

interface HistoricoMensagem {
  direcao: 'INBOUND' | 'OUTBOUND';   // INBOUND = cliente, OUTBOUND = Amélia/agente
  texto: string;
  timestamp?: string;                 // ISO 8601
  autor?: string;                     // 'cliente' | 'amelia' | 'agente:[nome]'
}

interface BlueChatResponse {
  success: boolean;
  
  // IDs para rastreamento
  lead_id: string | null;
  message_id: string | null;
  intent_id: string | null;
  
  // Resposta da Amélia
  resposta?: {
    texto: string;
    intent: string;
    confianca: number;
    acao_recomendada: string;
    escalar_humano: boolean;
    motivo_escalar?: string;
  };
  
  // Status do lead
  lead_status?: {
    temperatura: string;
    estado_funil: string;
    empresa: string;
    criado_agora: boolean;
  };
  
  // Erro se houver
  error?: string;
}

// ========================================
// AUTENTICAÇÃO
// ========================================

function validateAuth(req: Request): boolean {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');
  const secret = Deno.env.get('BLUECHAT_WEBHOOK_SECRET');
  
  if (!secret) {
    console.error('[Auth] BLUECHAT_WEBHOOK_SECRET não configurado');
    return false;
  }
  
  // Aceitar Bearer token ou X-API-Key
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === secret;
  }
  
  if (apiKeyHeader) {
    return apiKeyHeader === secret;
  }
  
  return false;
}

// ========================================
// NORMALIZAÇÃO DE TELEFONE
// ========================================

function normalizePhone(raw: string): string {
  let normalized = raw.replace(/\D/g, '');
  
  // Se tiver 11 dígitos (sem DDI), adiciona 55
  if (normalized.length === 11) {
    normalized = '55' + normalized;
  }
  
  // Se tiver 10 dígitos (DDD + 8 dígitos antigos), adiciona 55 e 9
  if (normalized.length === 10) {
    normalized = '55' + normalized.slice(0, 2) + '9' + normalized.slice(2);
  }
  
  return normalized;
}

// ========================================
// BUSCAR OU CRIAR LEAD
// ========================================

async function findOrCreateLead(
  supabase: ReturnType<typeof createClient>,
  payload: BlueChatPayload
): Promise<{ lead_id: string; empresa: string; criado_agora: boolean } | null> {
  
  const empresa = payload.lead_data?.empresa || 'BLUE';
  
  // 1. Se lead_id fornecido, verificar se existe
  if (payload.lead_id) {
    const { data: contact } = await supabase
      .from('lead_contacts')
      .select('lead_id, empresa')
      .eq('lead_id', payload.lead_id)
      .maybeSingle();
    
    if (contact) {
      console.log(`[Lead] Encontrado por lead_id: ${payload.lead_id}`);
      return { lead_id: (contact as any).lead_id, empresa: (contact as any).empresa, criado_agora: false };
    }
  }
  
  // 2. Buscar por telefone
  if (payload.telefone) {
    const normalized = normalizePhone(payload.telefone);
    console.log(`[Lead] Buscando por telefone: ${normalized}`);
    
    // Variações do telefone
    const variations = [
      normalized,
      normalized.replace(/^55/, ''),  // sem DDI
    ];
    
    const { data: contacts } = await supabase
      .from('lead_contacts')
      .select('lead_id, empresa, telefone, telefone_e164')
      .or(
        variations.map(v => `telefone.eq.${v},telefone_e164.eq.${v}`).join(',')
      )
      .limit(1);
    
    if (contacts && contacts.length > 0) {
      const contact = contacts[0] as any;
      console.log(`[Lead] Encontrado por telefone: ${contact.lead_id}`);
      return { lead_id: contact.lead_id, empresa: contact.empresa, criado_agora: false };
    }
  }
  
  // 3. Buscar por email
  if (payload.email) {
    const { data: contacts } = await supabase
      .from('lead_contacts')
      .select('lead_id, empresa')
      .ilike('email', payload.email)
      .limit(1);
    
    if (contacts && contacts.length > 0) {
      const contact = contacts[0] as any;
      console.log(`[Lead] Encontrado por email: ${contact.lead_id}`);
      return { lead_id: contact.lead_id, empresa: contact.empresa, criado_agora: false };
    }
  }
  
  // 4. Lead não encontrado - criar se configurado
  if (payload.config?.criar_lead_se_novo === false) {
    console.log('[Lead] Lead não encontrado e criação desabilitada');
    return null;
  }
  
  // Criar novo lead_contact
  console.log('[Lead] Criando novo lead...');
  
  const newLeadId = crypto.randomUUID();
  const telefoneNorm = payload.telefone ? normalizePhone(payload.telefone) : null;
  
  const { data: newContact, error: insertError } = await supabase
    .from('lead_contacts')
    .insert({
      lead_id: newLeadId,
      empresa: empresa,
      telefone: telefoneNorm,
      telefone_e164: telefoneNorm ? `+${telefoneNorm}` : null,
      email: payload.email || null,
      nome: payload.lead_data?.nome || null,
      primeiro_nome: payload.lead_data?.primeiro_nome || 
                     payload.lead_data?.nome?.split(' ')[0] || null,
      origem_telefone: 'BLUECHAT',
    } as any)
    .select()
    .single();
  
  if (insertError) {
    console.error('[Lead] Erro ao criar lead:', insertError);
    return null;
  }
  
  console.log(`[Lead] Novo lead criado: ${newLeadId}`);
  return { lead_id: newLeadId, empresa: empresa, criado_agora: true };
}

// ========================================
// SALVAR MENSAGEM INBOUND
// ========================================

async function saveInboundMessage(
  supabase: ReturnType<typeof createClient>,
  leadId: string | null,
  empresa: string,
  texto: string,
  bluechat?: BlueChatPayload['bluechat']
): Promise<string | null> {
  
  const { data: msg, error } = await supabase
    .from('lead_messages')
    .insert({
      lead_id: leadId,
      empresa: empresa,
      canal: bluechat?.canal_origem === 'email' ? 'EMAIL' : 'WHATSAPP',
      direcao: 'INBOUND',
      conteudo: texto,
      estado: leadId ? 'RECEBIDO' : 'UNMATCHED',
      recebido_em: new Date().toISOString(),
    } as any)
    .select('id')
    .single();
  
  if (error) {
    console.error('[Message] Erro ao salvar mensagem:', error);
    return null;
  }
  
  const msgData = msg as any;
  console.log(`[Message] Mensagem salva: ${msgData.id}`);
  return msgData.id;
}

// ========================================
// CHAMAR SDR-IA-INTERPRET
// ========================================

async function callSdrIaInterpret(
  messageId: string,
  leadId: string,
  empresa: string,
  texto: string,
  historico?: HistoricoMensagem[]
): Promise<{
  success: boolean;
  intent_id?: string;
  resposta?: string;
  intent?: string;
  confianca?: number;
  acao_recomendada?: string;
  escalar_humano?: boolean;
  motivo_escalar?: string;
  error?: string;
}> {
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    return { success: false, error: 'Configuração Supabase ausente' };
  }
  
  try {
    // Formatar histórico para contexto
    let historicoFormatado = '';
    if (historico && historico.length > 0) {
      historicoFormatado = historico
        .slice(-10) // Últimas 10 mensagens
        .map(h => `[${h.direcao === 'INBOUND' ? 'CLIENTE' : 'AMÉLIA'}]: ${h.texto}`)
        .join('\n');
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/sdr-ia-interpret`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        message_id: messageId,
        lead_id: leadId,
        empresa: empresa,
        texto: texto,
        historico_contexto: historicoFormatado,
        fonte: 'BLUECHAT',
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SDR-IA] Erro na chamada:', errorText);
      return { success: false, error: `SDR-IA error: ${response.status}` };
    }
    
    const result = await response.json();
    console.log('[SDR-IA] Resultado:', JSON.stringify(result).slice(0, 500));
    
    return {
      success: true,
      intent_id: result.intent_id,
      resposta: result.resposta_automatica,
      intent: result.intent,
      confianca: result.confidence,
      acao_recomendada: result.acao_recomendada,
      escalar_humano: result.escalar_humano || false,
      motivo_escalar: result.motivo_escalar,
    };
    
  } catch (error) {
    console.error('[SDR-IA] Erro:', error);
    return { success: false, error: String(error) };
  }
}

// ========================================
// BUSCAR STATUS DO LEAD
// ========================================

async function getLeadStatus(
  supabase: ReturnType<typeof createClient>,
  leadId: string
): Promise<{ temperatura: string; estado_funil: string } | null> {
  
  // Buscar classificação
  const { data: classification } = await supabase
    .from('lead_classifications')
    .select('temperatura')
    .eq('lead_id', leadId)
    .order('classificado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  // Buscar estado de conversa
  const { data: convState } = await supabase
    .from('lead_conversation_state')
    .select('estado_funil')
    .eq('lead_id', leadId)
    .maybeSingle();
  
  return {
    temperatura: (classification as any)?.temperatura || 'FRIO',
    estado_funil: (convState as any)?.estado_funil || 'SAUDACAO',
  };
}

// ========================================
// HANDLER PRINCIPAL
// ========================================

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Validar método
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // Validar autenticação
  if (!validateAuth(req)) {
    console.error('[Auth] Autenticação falhou');
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const payload: BlueChatPayload = await req.json();
    
    console.log('[BlueChat] Payload recebido:', JSON.stringify({
      telefone: payload.telefone?.slice(0, 8) + '***',
      email: payload.email ? '***@***' : null,
      lead_id: payload.lead_id,
      mensagem_preview: payload.mensagem?.slice(0, 50),
      bluechat: payload.bluechat,
      historico_count: payload.historico?.length || 0,
    }));
    
    // Validar payload mínimo
    if (!payload.mensagem) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campo "mensagem" é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!payload.telefone && !payload.email && !payload.lead_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Pelo menos um identificador é obrigatório: telefone, email ou lead_id' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Encontrar ou criar lead
    const leadResult = await findOrCreateLead(supabase, payload);
    
    if (!leadResult) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Lead não encontrado e criação desabilitada',
          lead_id: null,
          message_id: null,
          intent_id: null,
        } as BlueChatResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { lead_id, empresa, criado_agora } = leadResult;
    
    // 2. Salvar mensagem inbound
    const messageId = await saveInboundMessage(
      supabase,
      lead_id,
      empresa,
      payload.mensagem,
      payload.bluechat
    );
    
    // 3. Chamar SDR-IA para interpretar e responder
    let sdrResult = null;
    if (messageId && (payload.config?.retornar_resposta !== false)) {
      sdrResult = await callSdrIaInterpret(
        messageId,
        lead_id,
        empresa,
        payload.mensagem,
        payload.historico
      );
    }
    
    // 4. Buscar status atualizado do lead
    const leadStatus = await getLeadStatus(supabase, lead_id);
    
    // 5. Montar resposta
    const response: BlueChatResponse = {
      success: true,
      lead_id: lead_id,
      message_id: messageId,
      intent_id: sdrResult?.intent_id || null,
      lead_status: {
        temperatura: leadStatus?.temperatura || 'FRIO',
        estado_funil: leadStatus?.estado_funil || 'SAUDACAO',
        empresa: empresa,
        criado_agora: criado_agora,
      },
    };
    
    // Incluir resposta da Amélia se disponível
    if (sdrResult?.success && sdrResult.resposta) {
      response.resposta = {
        texto: sdrResult.resposta,
        intent: sdrResult.intent || 'OUTRO',
        confianca: sdrResult.confianca || 0,
        acao_recomendada: sdrResult.acao_recomendada || 'NENHUMA',
        escalar_humano: sdrResult.escalar_humano || false,
        motivo_escalar: sdrResult.motivo_escalar,
      };
    }
    
    console.log('[BlueChat] Resposta:', JSON.stringify({
      success: true,
      lead_id: lead_id,
      intent: sdrResult?.intent,
      escalar: sdrResult?.escalar_humano,
      resposta_preview: sdrResult?.resposta?.slice(0, 100),
    }));
    
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[BlueChat] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: String(error),
        lead_id: null,
        message_id: null,
        intent_id: null,
      } as BlueChatResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
