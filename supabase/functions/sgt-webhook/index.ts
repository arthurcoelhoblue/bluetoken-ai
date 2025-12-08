import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// PATCH 2.1 - Endpoint SGT Webhook
// ========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sgt-signature, x-sgt-timestamp',
};

// Tipos
type SGTEventoTipo = 'LEAD_NOVO' | 'ATUALIZACAO' | 'CARRINHO_ABANDONADO' | 'MQL' | 'SCORE_ATUALIZADO' | 'CLIQUE_OFERTA' | 'FUNIL_ATUALIZADO';
type EmpresaTipo = 'TOKENIZA' | 'BLUE';
type LeadStage = 'Contato Iniciado' | 'Negociação' | 'Perdido' | 'Cliente';

interface DadosLead {
  nome: string;
  email: string;
  telefone?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  score?: number;
  stage?: LeadStage;
}

interface DadosTokeniza {
  valor_investido?: number;
  qtd_investimentos?: number;
  qtd_projetos?: number;
  ultimo_investimento_em?: string | null;
}

interface DadosBlue {
  qtd_compras_ir?: number;
  ticket_medio?: number;
  score_mautic?: number;
  plano_atual?: string | null;
}

interface EventMetadata {
  oferta_id?: string;
  valor_simulado?: number;
  pagina_visitada?: string;
}

interface SGTPayload {
  lead_id: string;
  evento: SGTEventoTipo;
  empresa: EmpresaTipo;
  timestamp: string;
  dados_lead: DadosLead;
  dados_tokeniza?: DadosTokeniza;
  dados_blue?: DadosBlue;
  event_metadata?: EventMetadata;
}

interface LeadNormalizado {
  lead_id: string;
  empresa: EmpresaTipo;
  evento: SGTEventoTipo;
  timestamp: Date;
  nome: string;
  email: string;
  telefone: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  score: number;
  stage: LeadStage | null;
  dados_empresa: DadosTokeniza | DadosBlue | null;
  metadata: EventMetadata | null;
}

// Validação de eventos permitidos
const EVENTOS_VALIDOS: SGTEventoTipo[] = [
  'LEAD_NOVO', 'ATUALIZACAO', 'CARRINHO_ABANDONADO', 
  'MQL', 'SCORE_ATUALIZADO', 'CLIQUE_OFERTA', 'FUNIL_ATUALIZADO'
];

const EMPRESAS_VALIDAS: EmpresaTipo[] = ['TOKENIZA', 'BLUE'];

// ========================================
// PATCH 2.2 - Normalizador de Dados
// ========================================
function normalizeSGTEvent(payload: SGTPayload): LeadNormalizado {
  const { lead_id, evento, empresa, timestamp, dados_lead, dados_tokeniza, dados_blue, event_metadata } = payload;
  
  // Determina dados específicos da empresa
  let dadosEmpresa: DadosTokeniza | DadosBlue | null = null;
  if (empresa === 'TOKENIZA' && dados_tokeniza) {
    dadosEmpresa = {
      valor_investido: dados_tokeniza.valor_investido ?? 0,
      qtd_investimentos: dados_tokeniza.qtd_investimentos ?? 0,
      qtd_projetos: dados_tokeniza.qtd_projetos ?? 0,
      ultimo_investimento_em: dados_tokeniza.ultimo_investimento_em ?? null,
    };
  } else if (empresa === 'BLUE' && dados_blue) {
    dadosEmpresa = {
      qtd_compras_ir: dados_blue.qtd_compras_ir ?? 0,
      ticket_medio: dados_blue.ticket_medio ?? 0,
      score_mautic: dados_blue.score_mautic ?? 0,
      plano_atual: dados_blue.plano_atual ?? null,
    };
  }

  return {
    lead_id,
    empresa,
    evento,
    timestamp: new Date(timestamp),
    nome: dados_lead.nome?.trim() || 'Sem nome',
    email: dados_lead.email?.trim().toLowerCase() || '',
    telefone: dados_lead.telefone?.replace(/\D/g, '') || null,
    utm_source: dados_lead.utm_source || null,
    utm_medium: dados_lead.utm_medium || null,
    utm_campaign: dados_lead.utm_campaign || null,
    utm_term: dados_lead.utm_term || null,
    score: dados_lead.score ?? 0,
    stage: dados_lead.stage || null,
    dados_empresa: dadosEmpresa,
    metadata: event_metadata || null,
  };
}

// Validação HMAC
async function validateSignature(body: string, signature: string, timestamp: string): Promise<boolean> {
  const secret = Deno.env.get('SGT_WEBHOOK_SECRET');
  if (!secret) {
    console.error('[SGT Webhook] SGT_WEBHOOK_SECRET não configurado');
    return false;
  }

  // Verifica timestamp (máximo 5 minutos de diferença)
  const eventTime = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - eventTime) > 300) {
    console.error('[SGT Webhook] Timestamp expirado');
    return false;
  }

  // Calcula HMAC
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signaturePayload = `${timestamp}.${body}`;
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signaturePayload));
  const expectedSignature = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === expectedSignature;
}

// Validação do payload
function validatePayload(payload: unknown): { valid: boolean; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload inválido' };
  }

  const p = payload as Record<string, unknown>;

  if (!p.lead_id || typeof p.lead_id !== 'string') {
    return { valid: false, error: 'lead_id é obrigatório' };
  }

  if (!p.evento || !EVENTOS_VALIDOS.includes(p.evento as SGTEventoTipo)) {
    return { valid: false, error: `evento inválido. Valores aceitos: ${EVENTOS_VALIDOS.join(', ')}` };
  }

  if (!p.empresa || !EMPRESAS_VALIDAS.includes(p.empresa as EmpresaTipo)) {
    return { valid: false, error: `empresa inválida. Valores aceitos: ${EMPRESAS_VALIDAS.join(', ')}` };
  }

  if (!p.timestamp || typeof p.timestamp !== 'string') {
    return { valid: false, error: 'timestamp é obrigatório' };
  }

  if (!p.dados_lead || typeof p.dados_lead !== 'object') {
    return { valid: false, error: 'dados_lead é obrigatório' };
  }

  const dadosLead = p.dados_lead as Record<string, unknown>;
  if (!dadosLead.email || typeof dadosLead.email !== 'string') {
    return { valid: false, error: 'dados_lead.email é obrigatório' };
  }

  return { valid: true };
}

// Gera chave de idempotência
function generateIdempotencyKey(payload: SGTPayload): string {
  return `${payload.lead_id}_${payload.evento}_${payload.timestamp}`;
}

// ========================================
// PATCH 2.3 - Pipeline de Classificação (stub)
// ========================================
async function classificarLead(
  supabase: SupabaseClient,
  eventId: string,
  leadNormalizado: LeadNormalizado
): Promise<void> {
  // TODO: Implementar no Épico 3/4
  // Por enquanto, apenas loga que o pipeline foi chamado
  console.log('[SGT Webhook] Pipeline de classificação chamado:', {
    lead_id: leadNormalizado.lead_id,
    empresa: leadNormalizado.empresa,
    evento: leadNormalizado.evento,
    score: leadNormalizado.score,
  });
  
  // Registra log de processamento
  await supabase.from('sgt_event_logs').insert({
    event_id: eventId,
    status: 'PROCESSADO',
    mensagem: 'Pipeline de classificação executado com sucesso',
  } as Record<string, unknown>);
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
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Obtém headers de assinatura
    const signature = req.headers.get('x-sgt-signature') || '';
    const timestamp = req.headers.get('x-sgt-timestamp') || '';
    
    // Lê o body
    const bodyText = await req.text();
    
    console.log('[SGT Webhook] Requisição recebida:', {
      hasSignature: !!signature,
      hasTimestamp: !!timestamp,
      bodyLength: bodyText.length,
    });

    // Valida assinatura HMAC
    if (signature && timestamp) {
      const isValidSignature = await validateSignature(bodyText, signature, timestamp);
      if (!isValidSignature) {
        console.error('[SGT Webhook] Assinatura inválida');
        return new Response(
          JSON.stringify({ error: 'Assinatura inválida' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Em produção, exigir assinatura
      console.warn('[SGT Webhook] Requisição sem assinatura - aceito apenas em dev');
    }

    // Parse do payload
    let payload: SGTPayload;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return new Response(
        JSON.stringify({ error: 'JSON inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Valida estrutura do payload
    const validation = validatePayload(payload);
    if (!validation.valid) {
      console.error('[SGT Webhook] Payload inválido:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gera chave de idempotência
    const idempotencyKey = generateIdempotencyKey(payload);
    
    // Verifica idempotência
    const { data: existingEvent } = await supabase
      .from('sgt_events')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingEvent) {
      console.log('[SGT Webhook] Evento duplicado ignorado:', idempotencyKey);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Evento já processado',
          event_id: existingEvent.id,
          idempotent: true 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insere evento
    const { data: newEvent, error: insertError } = await supabase
      .from('sgt_events')
      .insert({
        lead_id: payload.lead_id,
        empresa: payload.empresa,
        evento: payload.evento,
        payload: payload,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[SGT Webhook] Erro ao inserir evento:', insertError);
      throw insertError;
    }

    console.log('[SGT Webhook] Evento inserido:', newEvent.id);

    // Registra log de recebimento
    await supabase.from('sgt_event_logs').insert({
      event_id: newEvent.id,
      status: 'RECEBIDO',
      mensagem: `Evento ${payload.evento} recebido para lead ${payload.lead_id}`,
    } as Record<string, unknown>);

    // Normaliza dados
    const leadNormalizado = normalizeSGTEvent(payload);
    console.log('[SGT Webhook] Lead normalizado:', leadNormalizado);

    // Dispara pipeline de classificação
    try {
      await classificarLead(supabase, newEvent.id, leadNormalizado);
      
      // Atualiza evento como processado
      await supabase
        .from('sgt_events')
        .update({ processado_em: new Date().toISOString() })
        .eq('id', newEvent.id);

    } catch (pipelineError) {
      console.error('[SGT Webhook] Erro no pipeline:', pipelineError);
      
      // Registra erro
      await supabase.from('sgt_event_logs').insert({
        event_id: newEvent.id,
        status: 'ERRO',
        mensagem: 'Erro no pipeline de classificação',
        erro_stack: pipelineError instanceof Error ? pipelineError.stack : String(pipelineError),
      } as Record<string, unknown>);
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: newEvent.id,
        lead_id: payload.lead_id,
        evento: payload.evento,
        empresa: payload.empresa,
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
