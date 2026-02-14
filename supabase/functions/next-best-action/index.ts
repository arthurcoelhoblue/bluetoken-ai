import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, empresa } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Gather context in parallel
    const [tarefasRes, slaRes, dealsParadosRes, leadsQuentesRes] = await Promise.all([
      // Pending tasks
      supabase
        .from('workbench_tarefas')
        .select('*')
        .eq('owner_id', user_id)
        .order('tarefa_prazo', { ascending: true, nullsFirst: false })
        .limit(10),
      // SLA alerts
      supabase
        .from('workbench_sla_alerts')
        .select('*')
        .eq('owner_id', user_id)
        .order('sla_percentual', { ascending: false })
        .limit(10),
      // Stale deals (open, not updated in 5+ days)
      supabase
        .from('deals')
        .select('id, titulo, valor, temperatura, updated_at, contacts!inner(nome), pipeline_stages!inner(nome)')
        .eq('owner_id', user_id)
        .eq('status', 'ABERTO')
        .lt('updated_at', new Date(Date.now() - 5 * 86400000).toISOString())
        .order('updated_at', { ascending: true })
        .limit(5),
      // Hot leads with recent messages
      supabase
        .from('lead_message_intents')
        .select('id, lead_id, intent, intent_summary, created_at')
        .in('intent', ['INTERESSE_COMPRA', 'INTERESSE_IR', 'AGENDAMENTO_REUNIAO', 'SOLICITACAO_CONTATO'])
        .gte('created_at', new Date(Date.now() - 3 * 86400000).toISOString())
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const tarefas = tarefasRes.data ?? [];
    const slaAlerts = slaRes.data ?? [];
    const dealsParados = dealsParadosRes.data ?? [];
    const leadsQuentes = leadsQuentesRes.data ?? [];

    // Build context for AI
    const contextSummary = {
      tarefas_pendentes: tarefas.map((t: any) => ({
        descricao: t.descricao,
        deal: t.deal_titulo,
        prazo: t.tarefa_prazo,
        valor: t.deal_valor,
        pipeline: t.pipeline_nome,
      })),
      sla_alerts: slaAlerts.map((a: any) => ({
        deal: a.deal_titulo,
        stage: a.stage_nome,
        contato: a.contact_nome,
        percentual: a.sla_percentual,
        estourado: a.sla_estourado,
        valor: a.deal_valor,
      })),
      deals_parados: dealsParados.map((d: any) => ({
        id: d.id,
        titulo: d.titulo,
        valor: d.valor,
        temperatura: d.temperatura,
        dias_parado: Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000),
        contato: d.contacts?.nome,
        stage: d.pipeline_stages?.nome,
      })),
      leads_quentes: leadsQuentes.map((l: any) => ({
        lead_id: l.lead_id,
        intent: l.intent,
        resumo: l.intent_summary,
        quando: l.created_at,
      })),
    };

    // Call Lovable AI Gateway with tool calling for structured output
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente de vendas que analisa o contexto do vendedor e sugere as 3-5 ações mais importantes para ele fazer AGORA.

Priorize:
1. SLAs estourados ou prestes a estourar (urgente)
2. Tarefas atrasadas ou para hoje
3. Leads quentes sem follow-up
4. Deals parados há muito tempo
5. Tarefas futuras próximas

Cada sugestão deve ter:
- titulo: frase curta e acionável (ex: "Retomar contato com João - deal parado há 12 dias")
- motivo: por que é importante (1 frase)
- deal_id: se aplicável
- lead_id: se aplicável
- prioridade: ALTA, MEDIA ou BAIXA
- tipo_acao: TAREFA, FOLLOW_UP, SLA, DEAL_PARADO, LEAD_QUENTE`
          },
          {
            role: 'user',
            content: `Contexto do vendedor:\n${JSON.stringify(contextSummary, null, 2)}\n\nSugira as próximas ações prioritárias.`
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_actions',
              description: 'Retorna 3-5 ações prioritárias para o vendedor.',
              parameters: {
                type: 'object',
                properties: {
                  acoes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        titulo: { type: 'string' },
                        motivo: { type: 'string' },
                        deal_id: { type: 'string' },
                        lead_id: { type: 'string' },
                        prioridade: { type: 'string', enum: ['ALTA', 'MEDIA', 'BAIXA'] },
                        tipo_acao: { type: 'string', enum: ['TAREFA', 'FOLLOW_UP', 'SLA', 'DEAL_PARADO', 'LEAD_QUENTE'] },
                      },
                      required: ['titulo', 'motivo', 'prioridade', 'tipo_acao'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['acoes'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_actions' } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[NBA] AI Gateway error:', aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit excedido, tente novamente em breve.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Erro ao processar sugestões' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    let acoes: any[] = [];

    // Extract from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        acoes = args.acoes || [];
      } catch {
        console.error('[NBA] Failed to parse tool call arguments');
      }
    }

    // Fallback: if no tool call, try parsing content
    if (acoes.length === 0) {
      const content = aiData.choices?.[0]?.message?.content;
      if (content) {
        try {
          const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(cleaned);
          acoes = parsed.acoes || parsed || [];
        } catch {
          console.error('[NBA] Failed to parse content fallback');
        }
      }
    }

    return new Response(JSON.stringify({ success: true, acoes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[NBA] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
