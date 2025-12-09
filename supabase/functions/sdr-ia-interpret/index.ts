import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// PATCH 5G-B - SDR IA Engine Evoluído
// Interpretação + Resposta Automática + Compliance
// ========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================================
// TIPOS
// ========================================

type EmpresaTipo = 'TOKENIZA' | 'BLUE';
type TemperaturaTipo = 'FRIO' | 'MORNO' | 'QUENTE';

type LeadIntentTipo =
  | 'INTERESSE_COMPRA'
  | 'INTERESSE_IR'
  | 'DUVIDA_PRODUTO'
  | 'DUVIDA_PRECO'
  | 'DUVIDA_TECNICA'
  | 'SOLICITACAO_CONTATO'
  | 'AGENDAMENTO_REUNIAO'
  | 'RECLAMACAO'
  | 'OPT_OUT'
  | 'OBJECAO_PRECO'
  | 'OBJECAO_RISCO'
  | 'SEM_INTERESSE'
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
  | 'ESCALAR_HUMANO'
  | 'ENVIAR_RESPOSTA_AUTOMATICA';

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
  respostaEnviada?: boolean;
  error?: string;
}

interface AIResponse {
  intent: LeadIntentTipo;
  confidence: number;
  summary: string;
  acao: SdrAcaoTipo;
  acao_detalhes?: Record<string, unknown>;
  resposta_sugerida?: string | null;
  deve_responder: boolean;
}

// ========================================
// PROMPT DO SDR IA COM COMPLIANCE
// ========================================

const SYSTEM_PROMPT = `Você é um SDR (Sales Development Representative) de IA especializado.
Sua função é interpretar mensagens de leads, identificar intenções, recomendar ações e, quando apropriado, sugerir uma resposta automática.

## EMPRESAS E PERSONAS

### TOKENIZA (Persona: Ana)
- Plataforma de investimentos em tokens (criptoativos, imóveis tokenizados)
- Tom: Amigável, didático, empolgado com inovação
- Foco: Educação financeira, diversificação, tokenização

### BLUE (Persona: Pedro)
- Serviços de declaração de imposto de renda para criptomoedas
- Tom: Profissional, confiável, técnico quando necessário
- Foco: Conformidade fiscal, elisão legal, economia tributária

## INTENÇÕES POSSÍVEIS

INTENÇÕES DE ALTA CONVERSÃO:
- INTERESSE_COMPRA: Lead quer investir/comprar (TOKENIZA)
- INTERESSE_IR: Lead interessado em serviço de IR (BLUE)
- AGENDAMENTO_REUNIAO: Quer marcar uma reunião/call
- SOLICITACAO_CONTATO: Pede para alguém ligar

INTENÇÕES DE NUTRIÇÃO:
- DUVIDA_PRODUTO: Pergunta sobre como funciona
- DUVIDA_PRECO: Pergunta sobre valores, taxas, custos
- DUVIDA_TECNICA: Pergunta técnica específica

OBJEÇÕES:
- OBJECAO_PRECO: Acha caro, não compensa
- OBJECAO_RISCO: Medo de perda, desconfiança

INTENÇÕES NEGATIVAS:
- SEM_INTERESSE: Não quer, mas sem opt-out explícito
- OPT_OUT: Pedindo para não receber mais mensagens
- RECLAMACAO: Expressando insatisfação ou problema

INTENÇÕES NEUTRAS:
- CUMPRIMENTO: Apenas "oi", "olá", "bom dia"
- AGRADECIMENTO: Agradecendo por algo
- NAO_ENTENDI: Mensagem confusa
- FORA_CONTEXTO: Não relacionada aos serviços
- OUTRO: Não se encaixa

## AÇÕES POSSÍVEIS

- ENVIAR_RESPOSTA_AUTOMATICA: Responder automaticamente ao lead
- CRIAR_TAREFA_CLOSER: Criar tarefa para humano atuar
- PAUSAR_CADENCIA: Pausar sequência de mensagens
- CANCELAR_CADENCIA: Cancelar sequência definitivamente
- AJUSTAR_TEMPERATURA: Alterar temperatura do lead (FRIO/MORNO/QUENTE)
- MARCAR_OPT_OUT: Registrar que lead não quer mais contato
- ESCALAR_HUMANO: Situação complexa requer humano
- NENHUMA: Nenhuma ação necessária

## REGRAS DE COMPLIANCE (CRÍTICAS!)

### PROIBIÇÕES ABSOLUTAS - NUNCA fazer:
1. ❌ NUNCA prometer retorno financeiro ou rentabilidade específica
2. ❌ NUNCA indicar ou recomendar ativo específico para investir
3. ❌ NUNCA inventar prazos ou metas de rentabilidade
4. ❌ NUNCA negociar preços ou oferecer descontos
5. ❌ NUNCA dar conselho de investimento personalizado
6. ❌ NUNCA pressionar ou usar urgência artificial

### PERMITIDO:
✅ Explicar conceitos gerais sobre tokenização/cripto
✅ Informar sobre processo de declaração de IR
✅ Convidar para conversar com especialista
✅ Tirar dúvidas procedimentais
✅ Agradecer e ser cordial

## MATRIZ DE DECISÃO: QUANDO RESPONDER?

| Intenção | Confiança | Ação Principal | Responder? |
|----------|-----------|----------------|------------|
| INTERESSE_COMPRA | >0.7 | CRIAR_TAREFA_CLOSER | SIM |
| INTERESSE_IR | >0.7 | CRIAR_TAREFA_CLOSER | SIM |
| DUVIDA_PRODUTO | >0.6 | ENVIAR_RESPOSTA_AUTOMATICA | SIM |
| DUVIDA_PRECO | >0.6 | CRIAR_TAREFA_CLOSER | NÃO (humano negocia) |
| DUVIDA_TECNICA | >0.6 | ENVIAR_RESPOSTA_AUTOMATICA | SIM |
| CUMPRIMENTO | >0.8 | ENVIAR_RESPOSTA_AUTOMATICA | SIM |
| AGRADECIMENTO | >0.8 | NENHUMA | SIM |
| OPT_OUT | >0.7 | MARCAR_OPT_OUT | NÃO |
| OBJECAO_PRECO | >0.6 | CRIAR_TAREFA_CLOSER | NÃO |
| OBJECAO_RISCO | >0.6 | ENVIAR_RESPOSTA_AUTOMATICA | SIM |
| SEM_INTERESSE | >0.7 | PAUSAR_CADENCIA | NÃO |
| RECLAMACAO | >0.6 | ESCALAR_HUMANO | NÃO |

## FORMATO DA RESPOSTA AUTOMÁTICA

Se deve_responder = true, forneça resposta_sugerida seguindo:
- 1 a 3 frases no máximo
- Tom humanizado (Ana/Pedro)
- Sempre terminar com próximo passo claro
- SEM promessas, SEM pressão

### Exemplos TOKENIZA (Ana):
- Dúvida: "Que legal sua pergunta! A tokenização permite investir em frações de ativos. Posso te explicar mais ou você prefere falar com nosso especialista?"
- Interesse: "Fico feliz que você se interessou! Vou pedir para um de nossos especialistas entrar em contato para te explicar tudo. Qual melhor horário?"

### Exemplos BLUE (Pedro):
- Dúvida IR: "Boa pergunta! A declaração de cripto tem algumas particularidades. Posso te passar para nosso contador especialista que vai esclarecer tudo pra você."
- Interesse: "Legal que você quer regularizar suas operações! Vou agendar uma conversa com nosso time para entender seu caso específico."

## RESPOSTA OBRIGATÓRIA (JSON)

{
  "intent": "TIPO_INTENT",
  "confidence": 0.85,
  "summary": "Resumo do que o lead quer",
  "acao": "TIPO_ACAO",
  "acao_detalhes": {},
  "deve_responder": true,
  "resposta_sugerida": "Sua resposta aqui..." ou null
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
): Promise<{ 
  message: LeadMessage; 
  historico: LeadMessage[]; 
  leadNome?: string; 
  cadenciaNome?: string;
  telefone?: string;
}> {
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
  let telefone: string | undefined;
  let cadenciaNome: string | undefined;

  // Se tiver lead_id, buscar histórico e contato
  if (msg.lead_id) {
    const { data: hist } = await supabase
      .from('lead_messages')
      .select('id, lead_id, run_id, empresa, conteudo, direcao, created_at')
      .eq('lead_id', msg.lead_id)
      .neq('id', messageId)
      .order('created_at', { ascending: false })
      .limit(5);

    historico = (hist || []) as LeadMessage[];

    // Buscar nome e telefone do lead
    const { data: contact } = await supabase
      .from('lead_contacts')
      .select('nome, primeiro_nome, telefone')
      .eq('lead_id', msg.lead_id)
      .limit(1)
      .maybeSingle();

    if (contact) {
      leadNome = contact.nome || contact.primeiro_nome;
      telefone = contact.telefone;
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

  return { message: msg, historico, leadNome, cadenciaNome, telefone };
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
  userPrompt += `PERSONA: ${empresa === 'TOKENIZA' ? 'Ana' : 'Pedro'}\n`;
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

  console.log('[IA] Resposta recebida:', { tokensUsados, tempoMs, content: content.substring(0, 300) });

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
      deve_responder: false,
      resposta_sugerida: null,
    };
  }

  // Validar e normalizar
  const validIntents: LeadIntentTipo[] = [
    'INTERESSE_COMPRA', 'INTERESSE_IR', 'DUVIDA_PRODUTO', 'DUVIDA_PRECO',
    'DUVIDA_TECNICA', 'SOLICITACAO_CONTATO', 'AGENDAMENTO_REUNIAO',
    'RECLAMACAO', 'OPT_OUT', 'OBJECAO_PRECO', 'OBJECAO_RISCO',
    'SEM_INTERESSE', 'NAO_ENTENDI', 'CUMPRIMENTO', 'AGRADECIMENTO',
    'FORA_CONTEXTO', 'OUTRO'
  ];
  const validAcoes: SdrAcaoTipo[] = [
    'PAUSAR_CADENCIA', 'CANCELAR_CADENCIA', 'RETOMAR_CADENCIA',
    'AJUSTAR_TEMPERATURA', 'CRIAR_TAREFA_CLOSER', 'MARCAR_OPT_OUT',
    'NENHUMA', 'ESCALAR_HUMANO', 'ENVIAR_RESPOSTA_AUTOMATICA'
  ];

  if (!validIntents.includes(parsed.intent)) {
    parsed.intent = 'OUTRO';
  }
  if (!validAcoes.includes(parsed.acao)) {
    parsed.acao = 'NENHUMA';
  }
  parsed.confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));
  parsed.deve_responder = parsed.deve_responder ?? false;

  return { response: parsed, tokensUsados, tempoMs };
}

/**
 * Envia resposta automática via WhatsApp
 */
async function sendAutoResponse(
  supabase: SupabaseClient,
  telefone: string,
  empresa: EmpresaTipo,
  resposta: string,
  leadId: string | null,
  runId: string | null
): Promise<{ success: boolean; messageId?: string }> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  console.log('[WhatsApp] Enviando resposta automática:', { telefone: telefone.substring(0, 6) + '...', empresa });

  try {
    // Chamar edge function whatsapp-send
    const response = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: telefone,
        message: resposta,
        empresa,
        leadId,
        runId,
        isAutoResponse: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[WhatsApp] Erro ao enviar:', response.status, errText);
      return { success: false };
    }

    const result = await response.json();
    console.log('[WhatsApp] Resposta enviada:', result);

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[WhatsApp] Erro:', error);
    return { success: false };
  }
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
  if (acao === 'NENHUMA' || acao === 'ENVIAR_RESPOSTA_AUTOMATICA') return false;
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
        // PATCH 5G-B: Implementação completa
        if (leadId && detalhes?.nova_temperatura) {
          const novaTemp = detalhes.nova_temperatura as TemperaturaTipo;
          const validTemps: TemperaturaTipo[] = ['FRIO', 'MORNO', 'QUENTE'];
          
          if (validTemps.includes(novaTemp)) {
            const { error } = await supabase
              .from('lead_classifications')
              .update({ 
                temperatura: novaTemp,
                updated_at: new Date().toISOString()
              })
              .eq('lead_id', leadId);
            
            if (!error) {
              console.log('[Ação] Temperatura ajustada:', { leadId, novaTemp });
              
              if (runId) {
                await supabase.from('lead_cadence_events').insert({
                  lead_cadence_run_id: runId,
                  step_ordem: 0,
                  template_codigo: 'SDR_IA_TEMPERATURA',
                  tipo_evento: 'RESPOSTA_DETECTADA',
                  detalhes: { acao, nova_temperatura: novaTemp },
                });
              }
              
              return true;
            }
          }
        }
        break;

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
  acaoAplicada: boolean,
  respostaEnviada: boolean,
  respostaTexto: string | null
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
    // PATCH 5G-B: Novos campos
    resposta_automatica_texto: respostaTexto,
    resposta_enviada_em: respostaEnviada ? new Date().toISOString() : null,
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
    const { message, historico, leadNome, cadenciaNome, telefone } = await loadMessageContext(supabase, messageId);
    
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
      deve_responder: aiResponse.deve_responder,
    });

    // 4. Aplicar ação (se aplicável)
    const acaoAplicada = await applyAction(
      supabase,
      message.run_id,
      message.lead_id,
      aiResponse.acao,
      aiResponse.acao_detalhes
    );

    // 5. PATCH 5G-B: Enviar resposta automática se aplicável
    let respostaEnviada = false;
    let respostaTexto: string | null = null;

    if (
      aiResponse.deve_responder &&
      aiResponse.resposta_sugerida &&
      telefone &&
      (aiResponse.acao === 'ENVIAR_RESPOSTA_AUTOMATICA' || aiResponse.acao === 'CRIAR_TAREFA_CLOSER')
    ) {
      respostaTexto = aiResponse.resposta_sugerida;
      
      const sendResult = await sendAutoResponse(
        supabase,
        telefone,
        message.empresa,
        respostaTexto,
        message.lead_id,
        message.run_id
      );
      
      respostaEnviada = sendResult.success;
      console.log('[SDR-IA] Resposta automática:', { enviada: respostaEnviada });
    }

    // 6. Salvar interpretação
    const intentId = await saveInterpretation(
      supabase,
      message,
      aiResponse,
      tokensUsados,
      tempoMs,
      acaoAplicada,
      respostaEnviada,
      respostaTexto
    );

    console.log('[SDR-IA] Interpretação salva:', intentId);

    const result: InterpretResult = {
      success: true,
      intentId,
      intent: aiResponse.intent,
      confidence: aiResponse.confidence,
      acao: aiResponse.acao,
      acaoAplicada,
      respostaEnviada,
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
