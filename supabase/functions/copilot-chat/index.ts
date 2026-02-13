import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// PATCH 7 — Copilot Chat (Amélia IA)
// Edge function para o assistente copilot dos vendedores
// Enriquece contexto com dados do CRM e chama Lovable AI Gateway
// ========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é a Amélia, consultora de vendas IA do Blue CRM (Grupo Blue).
Você ajuda vendedores a fechar mais negócios com insights do CRM.

Diretrizes:
- Responda SEMPRE em português brasileiro, de forma direta e acionável.
- Use os dados do CRM injetados no contexto para dar respostas personalizadas.
- NÃO invente dados — use apenas o que foi fornecido no contexto.
- Se não tiver dados suficientes, diga claramente o que falta.
- Seja concisa: prefira bullets e respostas curtas.
- Foque em ações práticas que o vendedor pode tomar agora.
- Quando sugerir mensagens, adapte ao perfil DISC e estágio do funil se disponíveis.
- Para leads Tokeniza, foque em investimentos tokenizados e rentabilidade.
- Para leads Blue, foque em IR/tributação cripto e compliance.`;

type ContextType = 'LEAD' | 'DEAL' | 'PIPELINE' | 'GERAL';

interface CopilotRequest {
  messages: Array<{ role: string; content: string }>;
  contextType: ContextType;
  contextId?: string;
  empresa: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { messages, contextType, contextId, empresa } = await req.json() as CopilotRequest;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[Copilot] LOVABLE_API_KEY não configurada');
      return new Response(
        JSON.stringify({ error: 'Configuração de IA ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client for context enrichment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ========================================
    // ENRIQUECIMENTO DE CONTEXTO
    // ========================================
    let contextBlock = '';

    try {
      switch (contextType) {
        case 'LEAD':
          contextBlock = await enrichLeadContext(supabase, contextId, empresa);
          break;
        case 'DEAL':
          contextBlock = await enrichDealContext(supabase, contextId);
          break;
        case 'PIPELINE':
          contextBlock = await enrichPipelineContext(supabase, empresa);
          break;
        case 'GERAL':
          contextBlock = await enrichGeralContext(supabase, empresa);
          break;
      }
    } catch (enrichError) {
      console.warn('[Copilot] Erro no enriquecimento (prosseguindo sem contexto):', enrichError);
      contextBlock = '⚠️ Não foi possível carregar dados do CRM para este contexto.';
    }

    // ========================================
    // MONTAR MENSAGENS PARA A IA
    // ========================================
    const systemContent = contextBlock
      ? `${SYSTEM_PROMPT}\n\n--- DADOS DO CRM ---\n${contextBlock}`
      : SYSTEM_PROMPT;

    const aiMessages = [
      { role: 'system', content: systemContent },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ];

    // ========================================
    // CHAMAR LOVABLE AI GATEWAY
    // ========================================
    console.log(`[Copilot] Chamando IA — contexto: ${contextType}, msgs: ${messages.length}`);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: aiMessages,
        stream: false,
      }),
    });

    // Handle rate limit / payment errors
    if (aiResponse.status === 429) {
      console.warn('[Copilot] Rate limit atingido (429)');
      return new Response(
        JSON.stringify({ error: 'Rate limit atingido. Tente novamente em alguns segundos.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (aiResponse.status === 402) {
      console.warn('[Copilot] Créditos insuficientes (402)');
      return new Response(
        JSON.stringify({ error: 'Créditos de IA insuficientes. Adicione créditos ao workspace.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[Copilot] Erro da IA Gateway:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar resposta da IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || 'Sem resposta da IA.';
    const tokensInput = aiData.usage?.prompt_tokens || 0;
    const tokensOutput = aiData.usage?.completion_tokens || 0;
    const model = aiData.model || 'google/gemini-3-flash-preview';
    const latencyMs = Date.now() - startTime;

    console.log(`[Copilot] Resposta OK — modelo: ${model}, tokens: ${tokensInput}+${tokensOutput}, latência: ${latencyMs}ms`);

    return new Response(
      JSON.stringify({
        content,
        model,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        latency_ms: latencyMs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Copilot] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ========================================
// FUNÇÕES DE ENRIQUECIMENTO
// ========================================

async function enrichLeadContext(supabase: any, leadId: string | undefined, empresa: string): Promise<string> {
  if (!leadId) return 'Nenhum lead selecionado.';

  const [classResult, msgsResult, stateResult, contactResult] = await Promise.all([
    supabase
      .from('lead_classifications')
      .select('icp, persona, temperatura, prioridade, score_interno, justificativa')
      .eq('lead_id', leadId)
      .eq('empresa', empresa)
      .order('classificado_em', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('lead_messages')
      .select('direcao, conteudo, canal, sender_type, created_at')
      .eq('lead_id', leadId)
      .eq('empresa', empresa)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('lead_conversation_state')
      .select('estado_funil, framework_ativo, framework_data, perfil_disc, perfil_investidor, modo, idioma_preferido')
      .eq('lead_id', leadId)
      .eq('empresa', empresa)
      .maybeSingle(),
    supabase
      .from('lead_contacts')
      .select('nome, primeiro_nome, email, telefone, empresa')
      .eq('lead_id', leadId)
      .eq('empresa', empresa)
      .maybeSingle(),
  ]);

  const parts: string[] = [];

  if (contactResult.data) {
    const c = contactResult.data;
    parts.push(`**Lead**: ${c.nome || c.primeiro_nome || 'Sem nome'} | Tel: ${c.telefone || '-'} | Email: ${c.email || '-'}`);
  }

  if (classResult.data) {
    const cl = classResult.data;
    parts.push(`**Classificação**: ICP=${cl.icp}, Persona=${cl.persona || '-'}, Temp=${cl.temperatura}, Prioridade=${cl.prioridade}, Score=${cl.score_interno || '-'}`);
    if (cl.justificativa) {
      parts.push(`**Justificativa**: ${JSON.stringify(cl.justificativa)}`);
    }
  }

  if (stateResult.data) {
    const st = stateResult.data;
    parts.push(`**Estado Conversa**: Funil=${st.estado_funil}, Framework=${st.framework_ativo}, DISC=${st.perfil_disc || '-'}, Perfil Investidor=${st.perfil_investidor || '-'}, Modo=${st.modo || 'SDR_IA'}, Idioma=${st.idioma_preferido}`);
    if (st.framework_data && Object.keys(st.framework_data).length > 0) {
      parts.push(`**Framework Data**: ${JSON.stringify(st.framework_data)}`);
    }
  }

  if (msgsResult.data && msgsResult.data.length > 0) {
    const msgs = msgsResult.data.reverse();
    const formatted = msgs.map((m: any) => {
      const dir = m.direcao === 'INBOUND' ? '← Lead' : `→ ${m.sender_type}`;
      return `[${dir}] ${m.conteudo.substring(0, 200)}`;
    }).join('\n');
    parts.push(`**Últimas ${msgs.length} mensagens**:\n${formatted}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Sem dados disponíveis para este lead.';
}

async function enrichDealContext(supabase: any, dealId: string | undefined): Promise<string> {
  if (!dealId) return 'Nenhum deal selecionado.';

  const [dealResult, activitiesResult] = await Promise.all([
    supabase
      .from('deals_full_detail')
      .select('*')
      .eq('id', dealId)
      .maybeSingle(),
    supabase
      .from('deal_activities')
      .select('tipo, descricao, metadata, created_at, tarefa_concluida, tarefa_prazo')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const parts: string[] = [];

  if (dealResult.data) {
    const d = dealResult.data;
    parts.push(`**Deal**: ${d.titulo || '-'}`);
    parts.push(`**Status**: ${d.status} | Valor: R$ ${d.valor || 0} | Temperatura: ${d.temperatura || '-'}`);
    if (d.stage_nome) parts.push(`**Estágio**: ${d.stage_nome} (Pipeline: ${d.pipeline_nome || '-'})`);
    if (d.contact_nome) parts.push(`**Contato**: ${d.contact_nome} | ${d.contact_email || '-'} | ${d.contact_telefone || '-'}`);
    if (d.motivo_perda) parts.push(`**Motivo Perda**: ${d.motivo_perda}`);
    if (d.notas) parts.push(`**Notas**: ${d.notas.substring(0, 300)}`);
  }

  if (activitiesResult.data && activitiesResult.data.length > 0) {
    const acts = activitiesResult.data.map((a: any) =>
      `- [${a.tipo}] ${a.descricao || '-'} (${new Date(a.created_at).toLocaleDateString('pt-BR')})`
    ).join('\n');
    parts.push(`**Últimas atividades**:\n${acts}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Sem dados disponíveis para este deal.';
}

async function enrichPipelineContext(supabase: any, empresa: string): Promise<string> {
  const [pipelinesResult, slaResult] = await Promise.all([
    supabase
      .from('workbench_pipeline_summary')
      .select('*')
      .limit(10),
    supabase
      .from('workbench_sla_alerts')
      .select('*')
      .limit(10),
  ]);

  const parts: string[] = [];

  if (pipelinesResult.data && pipelinesResult.data.length > 0) {
    const summary = pipelinesResult.data.map((p: any) =>
      `- ${p.pipeline_nome}: ${p.total_deals || 0} deals, R$ ${p.valor_total || 0}`
    ).join('\n');
    parts.push(`**Pipelines**:\n${summary}`);
  }

  if (slaResult.data && slaResult.data.length > 0) {
    parts.push(`**SLA Estourados**: ${slaResult.data.length} deals com SLA estourado`);
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Sem dados de pipeline disponíveis.';
}

async function enrichGeralContext(supabase: any, empresa: string): Promise<string> {
  // Light context for general questions
  const { data: pipelines } = await supabase
    .from('workbench_pipeline_summary')
    .select('*')
    .limit(5);

  if (pipelines && pipelines.length > 0) {
    const summary = pipelines.map((p: any) =>
      `- ${p.pipeline_nome}: ${p.total_deals || 0} deals, R$ ${p.valor_total || 0}`
    ).join('\n');
    return `**Resumo Pipelines**:\n${summary}`;
  }

  return 'Contexto geral — sem dados específicos carregados.';
}
