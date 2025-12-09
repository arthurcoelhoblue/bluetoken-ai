import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// PATCH 5G - SDR IA Engine
// Interpretação de mensagens inbound
// ========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================================
// TIPOS
// ========================================

type EmpresaTipo = 'TOKENIZA' | 'BLUE';

type LeadIntentTipo =
  | 'INTERESSE_COMPRA'
  | 'DUVIDA_PRODUTO'
  | 'DUVIDA_PRECO'
  | 'SOLICITACAO_CONTATO'
  | 'AGENDAMENTO_REUNIAO'
  | 'RECLAMACAO'
  | 'OPT_OUT'
  | 'NAO_ENTENDI'
  | 'CUMPRIMENTO'
  | 'AGRADECIMENTO'
  | 'FORA_CONTEXTO'
  | 'OUTRO';

type SdrAcaoTipo =
  | 'PAUSAR_CADENCIA'
  | 'CANCELAR_CADENCIA'
  | 'RETOMAR_CADENCIA'
  | 'AJUSTAR_TEMPERATURA'
  | 'CRIAR_TAREFA_CLOSER'
  | 'MARCAR_OPT_OUT'
  | 'NENHUMA'
  | 'ESCALAR_HUMANO';

interface LeadMessage {
  id: string;
  lead_id: string | null;
  run_id: string | null;
  empresa: EmpresaTipo;
  conteudo: string;
  direcao: string;
  created_at: string;
}

interface InterpretRequest {
  messageId: string;
}

interface InterpretResult {
  success: boolean;
  intentId?: string;
  intent?: LeadIntentTipo;
  confidence?: number;
  acao?: SdrAcaoTipo;
  acaoAplicada?: boolean;
  error?: string;
}

interface AIResponse {
  intent: LeadIntentTipo;
  confidence: number;
  summary: string;
  acao: SdrAcaoTipo;
  acao_detalhes?: Record<string, unknown>;
}

// ========================================
// PROMPT DO SDR IA
// ========================================

const SYSTEM_PROMPT = `Você é um SDR (Sales Development Representative) de IA altamente especializado.
Sua função é interpretar mensagens de leads e identificar a intenção por trás delas.

EMPRESAS:
- TOKENIZA: Plataforma de investimentos em tokens (criptoativos, imóveis tokenizados)
- BLUE: Serviços de declaração de imposto de renda para criptomoedas

INTENÇÕES POSSÍVEIS:
- INTERESSE_COMPRA: Lead demonstra interesse em comprar/investir
- DUVIDA_PRODUTO: Pergunta sobre como funciona o produto/serviço
- DUVIDA_PRECO: Pergunta sobre valores, taxas, custos
- SOLICITACAO_CONTATO: Pede para alguém ligar/entrar em contato
- AGENDAMENTO_REUNIAO: Quer marcar uma reunião/call
- RECLAMACAO: Expressando insatisfação ou problema
- OPT_OUT: Pedindo para não receber mais mensagens
- NAO_ENTENDI: Mensagem confusa ou sem sentido claro
- CUMPRIMENTO: Apenas dizendo "oi", "olá", "bom dia"
- AGRADECIMENTO: Agradecendo por algo
- FORA_CONTEXTO: Mensagem não relacionada aos serviços
- OUTRO: Não se encaixa em nenhuma categoria

AÇÕES RECOMENDADAS:
- PAUSAR_CADENCIA: Quando lead responde positivamente ou tem dúvida importante
- CANCELAR_CADENCIA: Quando lead pede opt-out ou demonstra total desinteresse
- CRIAR_TAREFA_CLOSER: Quando lead quer agendar reunião ou demonstra alta intenção de compra
- AJUSTAR_TEMPERATURA: Quando lead demonstra interesse mas precisa de mais aquecimento
- MARCAR_OPT_OUT: Quando lead explicitamente pede para não receber mensagens
- ESCALAR_HUMANO: Quando lead tem reclamação séria ou situação complexa
- NENHUMA: Quando é apenas cumprimento ou agradecimento simples

REGRAS IMPORTANTES:
1. NUNCA responda ao lead - apenas interprete
2. Seja conservador na confiança - use valores entre 0.6 e 0.95
3. Na dúvida, prefira ESCALAR_HUMANO
4. OPT_OUT deve ter ação MARCAR_OPT_OUT e CANCELAR_CADENCIA
5. INTERESSE_COMPRA alto deve ter CRIAR_TAREFA_CLOSER

Responda APENAS com JSON válido no formato:
{
  "intent": "TIPO_INTENT",
  "confidence": 0.85,
  "summary": "Resumo em uma frase do que o lead quer",
  "acao": "TIPO_ACAO",
  "acao_detalhes": {}
}`;

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

/**
 * Carrega contexto completo da mensagem
 */
async function loadMessageContext(
  supabase: SupabaseClient,
  messageId: string
): Promise<{ message: LeadMessage; historico: LeadMessage[]; leadNome?: string; cadenciaNome?: string }> {
  // Buscar mensagem principal
  const { data: message, error: msgError } = await supabase
    .from('lead_messages')
    .select('*')
    .eq('id', messageId)
    .single();

  if (msgError || !message) {
    throw new Error(`Mensagem não encontrada: ${messageId}`);
  }

  const msg = message as LeadMessage;
  let historico: LeadMessage[] = [];
  let leadNome: string | undefined;
  let cadenciaNome: string | undefined;

  // Se tiver lead_id, buscar histórico
  if (msg.lead_id) {
    const { data: hist } = await supabase
      .from('lead_messages')
      .select('id, lead_id, run_id, empresa, conteudo, direcao, created_at')
      .eq('lead_id', msg.lead_id)
      .neq('id', messageId)
      .order('created_at', { ascending: false })
      .limit(5);

    historico = (hist || []) as LeadMessage[];

    // Buscar nome do lead
    const { data: contact } = await supabase
      .from('lead_contacts')
      .select('nome, primeiro_nome')
      .eq('lead_id', msg.lead_id)
      .limit(1)
      .maybeSingle();

    if (contact) {
      leadNome = contact.nome || contact.primeiro_nome;
    }
  }

  // Se tiver run_id, buscar nome da cadência
  if (msg.run_id) {
    const { data: run } = await supabase
      .from('lead_cadence_runs')
      .select(`
        cadences:cadence_id (nome)
      `)
      .eq('id', msg.run_id)
      .single();

    if (run && (run as any).cadences) {
      cadenciaNome = (run as any).cadences.nome;
    }
  }

  return { message: msg, historico, leadNome, cadenciaNome };
}

/**
 * Chama a IA para interpretar a mensagem
 */
async function interpretWithAI(
  mensagem: string,
  empresa: EmpresaTipo,
  historico: LeadMessage[],
  leadNome?: string,
  cadenciaNome?: string
): Promise<{ response: AIResponse; tokensUsados: number; tempoMs: number }> {
  const startTime = Date.now();

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada');
  }

  // Montar contexto
  let userPrompt = `EMPRESA: ${empresa}\n`;
  if (leadNome) userPrompt += `LEAD: ${leadNome}\n`;
  if (cadenciaNome) userPrompt += `CADÊNCIA: ${cadenciaNome}\n`;
  
  if (historico.length > 0) {
    userPrompt += '\nHISTÓRICO RECENTE:\n';
    historico.reverse().forEach(h => {
      const dir = h.direcao === 'OUTBOUND' ? 'SDR' : 'LEAD';
      userPrompt += `[${dir}]: ${h.conteudo.substring(0, 200)}\n`;
    });
  }

  userPrompt += `\nMENSAGEM A INTERPRETAR:\n"${mensagem}"`;

  console.log('[IA] Enviando para interpretação:', { empresa, mensagemPreview: mensagem.substring(0, 100) });

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[IA] Erro na API:', response.status, errText);
    throw new Error(`Erro na API de IA: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const tokensUsados = data.usage?.total_tokens || 0;
  const tempoMs = Date.now() - startTime;

  if (!content) {
    throw new Error('Resposta vazia da IA');
  }

  console.log('[IA] Resposta recebida:', { tokensUsados, tempoMs, content: content.substring(0, 200) });

  // Parse do JSON
  let parsed: AIResponse;
  try {
    // Limpar possíveis marcadores de código
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('[IA] Erro ao parsear JSON:', content);
    // Fallback seguro
    parsed = {
      intent: 'NAO_ENTENDI',
      confidence: 0.5,
      summary: 'Não foi possível interpretar a mensagem',
      acao: 'ESCALAR_HUMANO',
    };
  }

  // Validar e normalizar
  const validIntents: LeadIntentTipo[] = [
    'INTERESSE_COMPRA', 'DUVIDA_PRODUTO', 'DUVIDA_PRECO', 'SOLICITACAO_CONTATO',
    'AGENDAMENTO_REUNIAO', 'RECLAMACAO', 'OPT_OUT', 'NAO_ENTENDI',
    'CUMPRIMENTO', 'AGRADECIMENTO', 'FORA_CONTEXTO', 'OUTRO'
  ];
  const validAcoes: SdrAcaoTipo[] = [
    'PAUSAR_CADENCIA', 'CANCELAR_CADENCIA', 'RETOMAR_CADENCIA',
    'AJUSTAR_TEMPERATURA', 'CRIAR_TAREFA_CLOSER', 'MARCAR_OPT_OUT',
    'NENHUMA', 'ESCALAR_HUMANO'
  ];

  if (!validIntents.includes(parsed.intent)) {
    parsed.intent = 'OUTRO';
  }
  if (!validAcoes.includes(parsed.acao)) {
    parsed.acao = 'NENHUMA';
  }
  parsed.confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));

  return { response: parsed, tokensUsados, tempoMs };
}

/**
 * Aplica ação interna recomendada
 */
async function applyAction(
  supabase: SupabaseClient,
  runId: string | null,
  leadId: string | null,
  acao: SdrAcaoTipo,
  detalhes?: Record<string, unknown>
): Promise<boolean> {
  if (acao === 'NENHUMA') return false;
  if (!runId && !leadId) return false;

  console.log('[Ação] Aplicando:', { acao, runId, leadId });

  try {
    switch (acao) {
      case 'PAUSAR_CADENCIA':
        if (runId) {
          await supabase
            .from('lead_cadence_runs')
            .update({ status: 'PAUSADA', updated_at: new Date().toISOString() })
            .eq('id', runId)
            .eq('status', 'ATIVA');
          
          // Registrar evento
          await supabase.from('lead_cadence_events').insert({
            lead_cadence_run_id: runId,
            step_ordem: 0,
            template_codigo: 'SDR_IA_ACAO',
            tipo_evento: 'RESPOSTA_DETECTADA',
            detalhes: { acao, motivo: 'Pausado automaticamente pela IA SDR' },
          });
          
          console.log('[Ação] Cadência pausada:', runId);
          return true;
        }
        break;

      case 'CANCELAR_CADENCIA':
        if (runId) {
          await supabase
            .from('lead_cadence_runs')
            .update({ status: 'CANCELADA', updated_at: new Date().toISOString() })
            .eq('id', runId)
            .in('status', ['ATIVA', 'PAUSADA']);
          
          await supabase.from('lead_cadence_events').insert({
            lead_cadence_run_id: runId,
            step_ordem: 0,
            template_codigo: 'SDR_IA_ACAO',
            tipo_evento: 'RESPOSTA_DETECTADA',
            detalhes: { acao, motivo: 'Cancelado automaticamente pela IA SDR' },
          });
          
          console.log('[Ação] Cadência cancelada:', runId);
          return true;
        }
        break;

      case 'MARCAR_OPT_OUT':
        // Cancela cadência + marca opt-out (futura tabela lead_preferences)
        if (runId) {
          await supabase
            .from('lead_cadence_runs')
            .update({ status: 'CANCELADA', updated_at: new Date().toISOString() })
            .eq('id', runId);
          
          await supabase.from('lead_cadence_events').insert({
            lead_cadence_run_id: runId,
            step_ordem: 0,
            template_codigo: 'SDR_IA_OPT_OUT',
            tipo_evento: 'RESPOSTA_DETECTADA',
            detalhes: { acao, motivo: 'Lead solicitou opt-out' },
          });
          
          console.log('[Ação] Opt-out marcado:', leadId);
          return true;
        }
        break;

      case 'CRIAR_TAREFA_CLOSER':
        // Registra evento para o closer atuar
        if (runId) {
          await supabase.from('lead_cadence_events').insert({
            lead_cadence_run_id: runId,
            step_ordem: 0,
            template_codigo: 'SDR_IA_TAREFA_CLOSER',
            tipo_evento: 'RESPOSTA_DETECTADA',
            detalhes: { 
              acao, 
              motivo: 'Lead demonstrou alta intenção - tarefa criada para closer',
              prioridade: 'ALTA',
              ...detalhes,
            },
          });
          
          // Pausar cadência enquanto closer atua
          await supabase
            .from('lead_cadence_runs')
            .update({ status: 'PAUSADA', updated_at: new Date().toISOString() })
            .eq('id', runId)
            .eq('status', 'ATIVA');
          
          console.log('[Ação] Tarefa criada para closer:', leadId);
          return true;
        }
        break;

      case 'ESCALAR_HUMANO':
        if (runId) {
          await supabase.from('lead_cadence_events').insert({
            lead_cadence_run_id: runId,
            step_ordem: 0,
            template_codigo: 'SDR_IA_ESCALAR',
            tipo_evento: 'RESPOSTA_DETECTADA',
            detalhes: { 
              acao, 
              motivo: 'Situação requer atenção humana',
              ...detalhes,
            },
          });
          
          console.log('[Ação] Escalado para humano:', leadId);
          return true;
        }
        break;

      case 'AJUSTAR_TEMPERATURA':
        // Futuro: atualizar lead_classifications
        console.log('[Ação] Ajuste de temperatura pendente (não implementado):', leadId);
        return false;

      default:
        return false;
    }
  } catch (error) {
    console.error('[Ação] Erro ao aplicar:', error);
    return false;
  }

  return false;
}

/**
 * Salva interpretação no banco
 */
async function saveInterpretation(
  supabase: SupabaseClient,
  message: LeadMessage,
  aiResponse: AIResponse,
  tokensUsados: number,
  tempoMs: number,
  acaoAplicada: boolean
): Promise<string> {
  const record = {
    message_id: message.id,
    lead_id: message.lead_id,
    run_id: message.run_id,
    empresa: message.empresa,
    intent: aiResponse.intent,
    intent_confidence: aiResponse.confidence,
    intent_summary: aiResponse.summary,
    acao_recomendada: aiResponse.acao,
    acao_aplicada: acaoAplicada,
    acao_detalhes: aiResponse.acao_detalhes || null,
    modelo_ia: 'google/gemini-2.5-flash',
    tokens_usados: tokensUsados,
    tempo_processamento_ms: tempoMs,
  };

  const { data, error } = await supabase
    .from('lead_message_intents')
    .insert(record)
    .select('id')
    .single();

  if (error) {
    console.error('[DB] Erro ao salvar interpretação:', error);
    throw error;
  }

  return (data as { id: string }).id;
}

// ========================================
// Handler Principal
// ========================================

serve(async (req) => {
  // CORS
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
    const { messageId }: InterpretRequest = await req.json();

    if (!messageId) {
      return new Response(
        JSON.stringify({ error: 'messageId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SDR-IA] Iniciando interpretação:', messageId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Carregar contexto
    const { message, historico, leadNome, cadenciaNome } = await loadMessageContext(supabase, messageId);
    
    // 2. Verificar se já foi interpretado
    const { data: existing } = await supabase
      .from('lead_message_intents')
      .select('id')
      .eq('message_id', messageId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log('[SDR-IA] Mensagem já interpretada:', messageId);
      return new Response(
        JSON.stringify({ success: true, intentId: (existing as { id: string }).id, status: 'ALREADY_INTERPRETED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Interpretar com IA
    const { response: aiResponse, tokensUsados, tempoMs } = await interpretWithAI(
      message.conteudo,
      message.empresa,
      historico,
      leadNome,
      cadenciaNome
    );

    console.log('[SDR-IA] Interpretação:', {
      intent: aiResponse.intent,
      confidence: aiResponse.confidence,
      acao: aiResponse.acao,
    });

    // 4. Aplicar ação (se aplicável)
    const acaoAplicada = await applyAction(
      supabase,
      message.run_id,
      message.lead_id,
      aiResponse.acao,
      aiResponse.acao_detalhes
    );

    // 5. Salvar interpretação
    const intentId = await saveInterpretation(
      supabase,
      message,
      aiResponse,
      tokensUsados,
      tempoMs,
      acaoAplicada
    );

    console.log('[SDR-IA] Interpretação salva:', intentId);

    const result: InterpretResult = {
      success: true,
      intentId,
      intent: aiResponse.intent,
      confidence: aiResponse.confidence,
      acao: aiResponse.acao,
      acaoAplicada,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SDR-IA] Erro:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
