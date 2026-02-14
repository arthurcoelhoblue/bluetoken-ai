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

    // Gather context in parallel — enriched with deal_scores, cs_alerts, cadences, sentiment
    const [
      tarefasRes, slaRes, dealsParadosRes, leadsQuentesRes,
      dealScoresRes, csAlertsRes, cadenceActiveRes, sentimentRecentRes,
    ] = await Promise.all([
      supabase.from('workbench_tarefas').select('*')
        .eq('owner_id', user_id).order('tarefa_prazo', { ascending: true, nullsFirst: false }).limit(10),
      supabase.from('workbench_sla_alerts').select('*')
        .eq('owner_id', user_id).order('sla_percentual', { ascending: false }).limit(10),
      supabase.from('deals').select('id, titulo, valor, temperatura, updated_at, contacts!inner(nome), pipeline_stages!inner(nome)')
        .eq('owner_id', user_id).eq('status', 'ABERTO')
        .lt('updated_at', new Date(Date.now() - 5 * 86400000).toISOString())
        .order('updated_at', { ascending: true }).limit(5),
      supabase.from('lead_message_intents').select('id, lead_id, intent, intent_summary, created_at')
        .in('intent', ['INTERESSE_COMPRA', 'INTERESSE_IR', 'AGENDAMENTO_REUNIAO', 'SOLICITACAO_CONTATO'])
        .gte('created_at', new Date(Date.now() - 3 * 86400000).toISOString())
        .order('created_at', { ascending: false }).limit(5),
      // NEW: Top 10 deal scores for this user
      supabase.from('deals').select('id, titulo, valor, score_probabilidade, scoring_dimensoes, proxima_acao_sugerida, pipeline_stages!inner(nome)')
        .eq('owner_id', user_id).eq('status', 'ABERTO').gt('score_probabilidade', 0)
        .order('score_probabilidade', { ascending: false }).limit(10),
      // NEW: CS alerts — customers with health < 60 or renewal within 30 days
      supabase.from('cs_customers').select('id, health_score, health_status, proxima_renovacao, contacts!inner(nome)')
        .or('health_score.lt.60,proxima_renovacao.lte.' + new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0])
        .eq('is_active', true).limit(10),
      // NEW: Active cadence runs
      supabase.from('cadence_runs').select('id, status, deal_id, deals(titulo)')
        .eq('status', 'ATIVA').limit(10),
      // NEW: Recent sentiment from lead messages
      supabase.from('lead_message_intents').select('lead_id, intent, sentimento, created_at')
        .not('sentimento', 'is', null)
        .gte('created_at', new Date(Date.now() - 2 * 86400000).toISOString())
        .order('created_at', { ascending: false }).limit(5),
    ]);

    const contextSummary = {
      tarefas_pendentes: (tarefasRes.data ?? []).map((t: any) => ({
        descricao: t.descricao, deal: t.deal_titulo, prazo: t.tarefa_prazo, valor: t.deal_valor, pipeline: t.pipeline_nome,
      })),
      sla_alerts: (slaRes.data ?? []).map((a: any) => ({
        deal: a.deal_titulo, stage: a.stage_nome, contato: a.contact_nome, percentual: a.sla_percentual, estourado: a.sla_estourado, valor: a.deal_valor,
      })),
      deals_parados: (dealsParadosRes.data ?? []).map((d: any) => ({
        id: d.id, titulo: d.titulo, valor: d.valor, temperatura: d.temperatura,
        dias_parado: Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000),
        contato: d.contacts?.nome, stage: d.pipeline_stages?.nome,
      })),
      leads_quentes: (leadsQuentesRes.data ?? []).map((l: any) => ({
        lead_id: l.lead_id, intent: l.intent, resumo: l.intent_summary, quando: l.created_at,
      })),
      deal_scores_top10: (dealScoresRes.data ?? []).map((d: any) => ({
        id: d.id, titulo: d.titulo, valor: d.valor, probabilidade: d.score_probabilidade,
        proxima_acao: d.proxima_acao_sugerida, stage: d.pipeline_stages?.nome,
      })),
      cs_alerts: (csAlertsRes.data ?? []).map((c: any) => ({
        cliente: c.contacts?.nome, health: c.health_score, status: c.health_status,
        renovacao: c.proxima_renovacao,
      })),
      cadence_active_count: cadenceActiveRes.data?.length ?? 0,
      sentiment_recent: (sentimentRecentRes.data ?? []).map((s: any) => ({
        lead_id: s.lead_id, sentimento: s.sentimento, intent: s.intent,
      })),
    };

    const systemPrompt = `Você é um assistente de vendas que analisa o contexto do vendedor e sugere as 3-5 ações mais importantes para ele fazer AGORA.

Priorize:
1. SLAs estourados ou prestes a estourar (urgente)
2. Tarefas atrasadas ou para hoje
3. Leads quentes sem follow-up
4. Deals parados há muito tempo
5. Deals com alta probabilidade que precisam de atenção (deal_scores)
6. Clientes CS em risco (health baixo ou renovação próxima)
7. Sentimento negativo recente em conversas

Retorne APENAS um JSON válido com a estrutura:
{
  "narrativa_dia": "2-3 frases resumindo o foco do dia para o vendedor, em tom direto e motivacional",
  "acoes": [{"titulo": "string", "motivo": "string", "deal_id": "string ou null", "lead_id": "string ou null", "prioridade": "ALTA|MEDIA|BAIXA", "tipo_acao": "TAREFA|FOLLOW_UP|SLA|DEAL_PARADO|LEAD_QUENTE|CS_RISCO"}]
}

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
        messages: [{ role: 'user', content: `Contexto do vendedor:\n${JSON.stringify(contextSummary, null, 2)}\n\nSugira as próximas ações prioritárias com narrativa do dia.` }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[NBA] Anthropic error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit excedido, tente novamente em breve.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Erro ao processar sugestões' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.content?.[0]?.text ?? '';
    let acoes: any[] = [];
    let narrativa_dia = '';

    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      acoes = parsed.acoes || [];
      narrativa_dia = parsed.narrativa_dia || '';
    } catch {
      console.error('[NBA] Failed to parse AI response');
    }

    return new Response(JSON.stringify({ success: true, acoes, narrativa_dia }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[NBA] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
