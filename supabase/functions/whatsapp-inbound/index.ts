import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// PATCH 5F - WhatsApp Inbound Webhook
// Recebe mensagens de leads via WhatsApp
// ========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// ========================================
// TIPOS
// ========================================
type EmpresaTipo = 'TOKENIZA' | 'BLUE';

interface InboundPayload {
  from: string;           // +5561998317422
  message_id: string;     // ID externo da mensagem
  timestamp: string;      // ISO timestamp
  text: string;           // Conteúdo da mensagem
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

/**
 * Normaliza número de telefone para formato consistente
 * Input: +5561998317422, 5561998317422, 61998317422
 * Output: 5561998317422
 */
function normalizePhone(raw: string): string {
  let normalized = raw.replace(/\D/g, '');
  
  // Se tiver 11 dígitos (sem DDI), adiciona 55
  if (normalized.length === 11) {
    normalized = '55' + normalized;
  }
  
  return normalized;
}

/**
 * Valida autenticação do webhook
 */
function validateAuth(req: Request): boolean {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');
  
  const inboundSecret = Deno.env.get('WHATSAPP_INBOUND_SECRET');
  
  if (!inboundSecret) {
    console.error('[Auth] WHATSAPP_INBOUND_SECRET não configurado');
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
  
  console.warn('[Auth] Token inválido');
  return false;
}

/**
 * Gera variações do telefone para busca flexível
 * Trata variações do nono dígito brasileiro
 */
function generatePhoneVariations(phone: string): string[] {
  const variations: string[] = [phone];
  
  // Remove DDI se presente (55)
  const withoutDDI = phone.startsWith('55') ? phone.slice(2) : phone;
  const ddd = withoutDDI.slice(0, 2); // Ex: 61
  const number = withoutDDI.slice(2);  // Ex: 98317422 ou 998317422
  
  // Se tem 8 dígitos (sem nono), adiciona variação com 9
  if (number.length === 8) {
    const withNine = `55${ddd}9${number}`;
    variations.push(withNine);
    variations.push(`${ddd}9${number}`);
  }
  
  // Se tem 9 dígitos (com nono), adiciona variação sem 9
  if (number.length === 9 && number.startsWith('9')) {
    const withoutNine = `55${ddd}${number.slice(1)}`;
    variations.push(withoutNine);
    variations.push(`${ddd}${number.slice(1)}`);
  }
  
  // Adiciona versões sem DDI
  variations.push(withoutDDI);
  
  return [...new Set(variations)]; // Remove duplicatas
}

/**
 * Busca lead pelo telefone normalizado
 * Tenta múltiplas variações para lidar com nono dígito
 */
async function findLeadByPhone(
  supabase: SupabaseClient,
  phoneNormalized: string
): Promise<LeadContact | null> {
  console.log('[Lead] Buscando por telefone:', phoneNormalized);
  
  // Gera todas as variações possíveis
  const variations = generatePhoneVariations(phoneNormalized);
  console.log('[Lead] Variações a testar:', variations);
  
  // Busca exata com todas as variações
  for (const variant of variations) {
    const { data: exactMatch } = await supabase
      .from('lead_contacts')
      .select('*')
      .eq('telefone', variant)
      .limit(1)
      .maybeSingle();
      
    if (exactMatch) {
      console.log('[Lead] Match exato encontrado com variação:', variant, '->', (exactMatch as LeadContact).lead_id);
      return exactMatch as LeadContact;
    }
  }
  
  // Tenta busca parcial com os últimos 8 dígitos (número sem DDD e sem nono)
  const last8Digits = phoneNormalized.slice(-8);
  const { data: partialMatch } = await supabase
    .from('lead_contacts')
    .select('*')
    .like('telefone', `%${last8Digits}`)
    .limit(1)
    .maybeSingle();
    
  if (partialMatch) {
    console.log('[Lead] Match parcial (últimos 8 dígitos) encontrado:', (partialMatch as LeadContact).lead_id);
    return partialMatch as LeadContact;
  }
  
  console.log('[Lead] Nenhum lead encontrado para:', phoneNormalized);
  return null;
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
    
  if (data) {
    console.log('[Run] Run ativa encontrada:', (data as LeadCadenceRun).id);
    return data as LeadCadenceRun;
  }
  
  return null;
}

/**
 * Verifica se mensagem já foi processada (idempotência)
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
 * Registra mensagem inbound
 */
async function saveInboundMessage(
  supabase: SupabaseClient,
  payload: InboundPayload,
  leadContact: LeadContact | null,
  activeRun: LeadCadenceRun | null
): Promise<InboundResult> {
  // Verificar duplicata
  if (await isDuplicate(supabase, payload.message_id)) {
    console.log('[Inbound] Mensagem duplicada:', payload.message_id);
    return {
      success: true,
      status: 'DUPLICATE',
      messageId: payload.message_id,
    };
  }
  
  // Determinar empresa (do lead ou default)
  const empresa: EmpresaTipo = leadContact?.empresa || 'TOKENIZA';
  
  // Montar registro
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
  
  console.log('[Inbound] Salvando mensagem:', {
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
    console.error('[Inbound] Erro ao salvar:', error);
    return {
      success: false,
      status: 'ERROR',
      error: error.message,
    };
  }
  
  const savedMessage = data as { id: string };
  console.log('[Inbound] Mensagem salva:', savedMessage.id);
  
  // Se tiver run ativa, registrar evento de resposta detectada
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
    console.log('[Inbound] Evento RESPOSTA_DETECTADA registrado');
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
    console.error('[Inbound] Acesso não autorizado');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const payload: InboundPayload = await req.json();
    
    console.log('[Inbound] Webhook recebido:', {
      from: payload.from,
      message_id: payload.message_id,
      textPreview: payload.text?.substring(0, 50),
    });

    if (!payload.from || !payload.message_id || !payload.text) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: from, message_id, text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phoneNormalized = normalizePhone(payload.from);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar lead pelo telefone
    const leadContact = await findLeadByPhone(supabase, phoneNormalized);
    
    // 2. Buscar run ativa (se lead encontrado)
    let activeRun: LeadCadenceRun | null = null;
    if (leadContact) {
      activeRun = await findActiveRun(supabase, leadContact.lead_id, leadContact.empresa);
    }
    
    // 3. Salvar mensagem
    const result = await saveInboundMessage(supabase, payload, leadContact, activeRun);
    
    // 4. Disparar interpretação IA (PATCH 5G)
    if (result.success && result.messageId && result.status === 'MATCHED') {
      try {
        const supabaseFunctionsUrl = Deno.env.get('SUPABASE_URL')!;
        const response = await fetch(`${supabaseFunctionsUrl}/functions/v1/sdr-ia-interpret`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ messageId: result.messageId }),
        });
        
        if (response.ok) {
          const iaResult = await response.json();
          console.log('[Inbound] Interpretação IA:', iaResult);
          (result as any).iaInterpretation = iaResult;
        } else {
          console.error('[Inbound] Erro ao chamar SDR IA:', response.status);
        }
      } catch (iaError) {
        console.error('[Inbound] Erro ao disparar interpretação:', iaError);
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
    console.error('[Inbound] Erro geral:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
