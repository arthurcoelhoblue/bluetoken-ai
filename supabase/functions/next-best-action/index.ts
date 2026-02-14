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

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Gather context in parallel
    const [tarefasRes, slaRes, dealsParadosRes, leadsQuentesRes] = await Promise.all([
      supabase.from('workbench_tarefas').select('*').eq('owner_id', user_id).order('tarefa_prazo', { ascending: true, nullsFirst: false }).limit(10),
      supabase.from('workbench_sla_alerts').select('*').eq('owner_id', user_id).order('sla_percentual', { ascending: false }).limit(10),
      supabase.from('deals').select('id, titulo, valor, temperatura, updated_at, contacts!inner(nome), pipeline_stages!inner(nome)').eq('owner_id', user_id).eq('status', 'ABERTO').lt('updated_at', new Date(Date.now() - 5 * 86400000).toISOString()).order('updated_at', { ascending: true }).limit(5),
      supabase.from('lead_message_intents').select('id, lead_id, intent, intent_summary, created_at').in('intent', ['INTERESSE_COMPRA', 'INTERESSE_IR', 'AGENDAMENTO_REUNIAO', 'SOLICITACAO_CONTATO']).gte('created_at', new Date(Date.now() - 3 * 86400000).toISOString()).order('created_at', { ascending: false }).limit(5),
    ]);

    const contextSummary = {
      tarefas_pendentes: (tarefasRes.data ?? []).map((t: any) => ({ descricao: t.descricao, deal: t.deal_titulo, prazo: t.tarefa_prazo, valor: t.deal_valor, pipeline: t.pipeline_nome })),
      sla_alerts: (slaRes.data ?? []).map((a: any) => ({ deal: a.deal_titulo, stage: a.stage_nome, contato: a.contact_nome, percentual: a.sla_percentual, estourado: a.sla_estourado, valor: a.deal_valor })),
      deals_parados: (dealsParadosRes.data ?? []).map((d: any) => ({ id: d.id, titulo: d.titulo, valor: d.valor, temperatura: d.temperatura, dias_parado: Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000), contato: d.contacts?.nome, stage: d.pipeline_stages?.nome })),
      leads_quentes: (leadsQuentesRes.data ?? []).map((l: any) => ({ lead_id: l.lead_id, intent: l.intent, resumo: l.intent_summary, quando: l.created_at })),
    };

    const systemPrompt = `Você é um assistente de vendas que analisa o contexto do vendedor e sugere as 3-5 ações mais importantes para ele fazer AGORA.

Priorize:
1. SLAs estourados ou prestes a estourar (urgente)
2. Tarefas atrasadas ou para hoje
3. Leads quentes sem follow-up
4. Deals parados há muito tempo
5. Tarefas futuras próximas

Retorne APENAS um JSON válido com a estrutura:
{"acoes": [{"titulo": "string", "motivo": "string", "deal_id": "string ou null", "lead_id": "string ou null", "prioridade": "ALTA|MEDIA|BAIXA", "tipo_acao": "TAREFA|FOLLOW_UP|SLA|DEAL_PARADO|LEAD_QUENTE"}]}

Sem markdown, sem explicação, apenas o JSON.`;

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Contexto do vendedor:\n${JSON.stringify(contextSummary, null, 2)}\n\nSugira as próximas ações prioritárias.` }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[NBA] Anthropic error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit excedido, tente novamente em breve.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'Erro ao processar sugestões' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await aiResponse.json();
    const content = aiData.content?.[0]?.text ?? '';
    let acoes: any[] = [];

    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      acoes = parsed.acoes || parsed || [];
    } catch {
      console.error('[NBA] Failed to parse AI response');
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
