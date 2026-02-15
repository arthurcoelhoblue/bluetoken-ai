import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DealFeatures {
  deal_id: string;
  titulo: string;
  valor: number;
  dias_no_stage_atual: number;
  total_atividades: number;
  ultima_atividade_dias_atras: number | null;
  taxa_resposta: number | null;
  score_probabilidade: number;
  icp_score: number | null;
  temperatura: string | null;
  canal_principal: string | null;
  probabilidade_ajustada?: number;
  justificativa?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* cron call */ }

    const { empresa } = body;
    const targetEmpresa = empresa || null;

    console.log('[RevenueForecast] Starting forecast generation with feature engineering');

    // Gather data in parallel
    const [openDealsRes, csCustomersRes, wonDealsRes, lostDealsRes] = await Promise.all([
      (() => {
        let q = supabase.from('deals').select('id, titulo, valor, score_probabilidade, pipeline_id, stage_id, created_at, updated_at, contact_id, lead_id, pipeline_empresa')
          .eq('status', 'ABERTO');
        if (targetEmpresa) q = q.eq('pipeline_empresa', targetEmpresa);
        return q.limit(500);
      })(),
      (() => {
        let q = supabase.from('cs_customers').select('id, valor_mrr, risco_churn_pct, empresa')
          .eq('is_active', true);
        if (targetEmpresa) q = q.eq('empresa', targetEmpresa);
        return q.limit(500);
      })(),
      (() => {
        let q = supabase.from('deals').select('id, titulo, valor, pipeline_id, created_at, data_ganho, pipeline_empresa')
          .eq('status', 'GANHO')
          .gte('data_ganho', new Date(Date.now() - 180 * 86400000).toISOString());
        return q.limit(500);
      })(),
      (() => {
        let q = supabase.from('deals').select('id, valor, created_at, updated_at')
          .eq('status', 'PERDIDO')
          .gte('updated_at', new Date(Date.now() - 180 * 86400000).toISOString());
        return q.limit(500);
      })(),
    ]);

    const openDeals = openDealsRes.data ?? [];
    const csCustomers = csCustomersRes.data ?? [];
    const wonDeals = wonDealsRes.data ?? [];
    const lostDeals = lostDealsRes.data ?? [];

    // === Feature Engineering for each open deal ===
    const dealFeatures: DealFeatures[] = [];
    
    // Fetch activities and messages for feature extraction
    const dealIds = openDeals.map(d => d.id);
    const [activitiesRes, leadIds] = await Promise.all([
      dealIds.length > 0 ? supabase.from('deal_activities').select('deal_id, created_at').in('deal_id', dealIds.slice(0, 100)) : { data: [] },
      Promise.resolve(openDeals.map(d => d.lead_id).filter(Boolean)),
    ]);

    const activitiesByDeal: Record<string, any[]> = {};
    for (const act of (activitiesRes.data || [])) {
      if (!activitiesByDeal[act.deal_id]) activitiesByDeal[act.deal_id] = [];
      activitiesByDeal[act.deal_id].push(act);
    }

    // Fetch lead classifications for ICP scores
    const classMap: Record<string, any> = {};
    if (leadIds.length > 0) {
      const { data: classifications } = await supabase.from('lead_classifications')
        .select('lead_id, score_interno, temperatura, icp')
        .in('lead_id', leadIds.slice(0, 100));
      for (const c of (classifications || [])) {
        classMap[c.lead_id] = c;
      }
    }

    const now = Date.now();
    for (const deal of openDeals) {
      const activities = activitiesByDeal[deal.id] || [];
      const lastActivity = activities.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const classification = deal.lead_id ? classMap[deal.lead_id] : null;
      
      const diasNoStage = Math.floor((now - new Date(deal.updated_at).getTime()) / 86400000);

      dealFeatures.push({
        deal_id: deal.id,
        titulo: deal.titulo || '',
        valor: deal.valor || 0,
        dias_no_stage_atual: diasNoStage,
        total_atividades: activities.length,
        ultima_atividade_dias_atras: lastActivity ? Math.floor((now - new Date(lastActivity.created_at).getTime()) / 86400000) : null,
        taxa_resposta: null, // Would need message data
        score_probabilidade: deal.score_probabilidade || 30,
        icp_score: classification?.score_interno || null,
        temperatura: classification?.temperatura || null,
        canal_principal: null,
      });
    }

    // === Pipeline Revenue (weighted by probability) ===
    let pipelineWeighted = 0;
    let pipelineTotal = 0;

    for (const feat of dealFeatures) {
      const prob = feat.score_probabilidade / 100;
      pipelineWeighted += feat.valor * prob;
      pipelineTotal += feat.valor;
    }

    // === MRR Retention ===
    let mrrTotal = 0;
    let mrrRetained = 0;
    for (const cust of csCustomers) {
      const mrr = cust.valor_mrr || 0;
      const churnRisk = (cust.risco_churn_pct || 5) / 100;
      mrrTotal += mrr;
      mrrRetained += mrr * (1 - churnRisk);
    }

    // === Pipeline Velocity ===
    const closeTimes = wonDeals
      .filter((d: any) => d.data_ganho && d.created_at)
      .map((d: any) => (new Date(d.data_ganho).getTime() - new Date(d.created_at).getTime()) / 86400000);
    const avgCloseTime = closeTimes.length > 0
      ? closeTimes.reduce((a: number, b: number) => a + b, 0) / closeTimes.length : 45;
    const avgDealValue = wonDeals.length > 0
      ? wonDeals.reduce((s: number, d: any) => s + (d.valor || 0), 0) / wonDeals.length : 0;
    const avgWinRate = wonDeals.length > 0 ? wonDeals.length / (wonDeals.length + lostDeals.length) : 0.2;
    const pipelineVelocity = avgCloseTime > 0
      ? (openDeals.length * avgDealValue * avgWinRate) / avgCloseTime : 0;

    // === AI Narrative Prediction ===
    let aiNarrative: any = null;
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    
    if (ANTHROPIC_API_KEY && dealFeatures.length > 0) {
      try {
        const topDeals = dealFeatures.sort((a, b) => b.valor - a.valor).slice(0, 15);
        const wonPattern = `${wonDeals.length} deals ganhos nos últimos 180 dias, valor médio R$${Math.round(avgDealValue)}, tempo médio ${Math.round(avgCloseTime)} dias. Win rate: ${Math.round(avgWinRate * 100)}%.`;
        
        const dealsText = topDeals.map(d => 
          `${d.titulo}: R$${d.valor}, ${d.dias_no_stage_atual}d no stage, ${d.total_atividades} atividades, score ${d.score_probabilidade}, temp ${d.temperatura || 'N/A'}`
        ).join('\n');

        const aiPrompt = `Analise os deals abertos contra o padrão de deals ganhos e gere previsão de receita.

PADRÃO DE SUCESSO:
${wonPattern}

TOP DEALS ABERTOS:
${dealsText}

MRR: R$${Math.round(mrrTotal)}, Retido estimado: R$${Math.round(mrrRetained)}

Para cada deal, gere uma probabilidade ajustada (0-100). Retorne JSON:
{
  "analise_geral": "2-3 frases sobre a saúde do pipeline",
  "top_riscos": ["risco 1", "risco 2", "risco 3"],
  "top_sinais_positivos": ["sinal 1", "sinal 2", "sinal 3"],
  "deals_destaque": [{"titulo": "...", "probabilidade_ajustada": 75, "justificativa": "..."}]
}`;

        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, temperature: 0.3, messages: [{ role: 'user', content: aiPrompt }] }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const text = data.content?.[0]?.text || '';
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) aiNarrative = JSON.parse(jsonMatch[0]);

          // Log AI usage
          await supabase.from('ai_usage_log').insert({
            function_name: 'revenue-forecast', provider: 'claude', model: 'claude-sonnet-4-20250514',
            tokens_input: data.usage?.input_tokens || 0, tokens_output: data.usage?.output_tokens || 0,
            latency_ms: 0, success: true, empresa: targetEmpresa,
          });
        }
      } catch (aiErr) {
        console.warn('[RevenueForecast] AI narrative failed:', aiErr);
      }
    }

    const forecast30d = {
      pessimista: Math.round(pipelineWeighted * 0.6 + mrrRetained),
      realista: Math.round(pipelineWeighted + mrrRetained),
      otimista: Math.round(pipelineWeighted * 1.3 + mrrTotal),
    };

    const forecast90d = {
      pessimista: Math.round(forecast30d.pessimista * 2.5),
      realista: Math.round(forecast30d.realista * 2.8),
      otimista: Math.round(forecast30d.otimista * 3.2),
    };

    const result = {
      generated_at: new Date().toISOString(),
      pipeline_total: Math.round(pipelineTotal),
      pipeline_weighted: Math.round(pipelineWeighted),
      mrr_total: Math.round(mrrTotal),
      mrr_retained: Math.round(mrrRetained),
      arr_total: Math.round(mrrTotal * 12),
      arr_retained: Math.round(mrrRetained * 12),
      avg_close_days: Math.round(avgCloseTime),
      avg_deal_value: Math.round(avgDealValue),
      pipeline_velocity_daily: Math.round(pipelineVelocity),
      open_deals_count: openDeals.length,
      active_customers: csCustomers.length,
      win_rate: Math.round(avgWinRate * 100),
      forecast_30d: forecast30d,
      forecast_90d: forecast90d,
      ai_narrative: aiNarrative,
    };

    // Save to system_settings
    await supabase.from('system_settings').upsert({
      key: 'revenue_forecast',
      value: result,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: 'key' });

    // Save to forecast log with features
    const empresaLog = targetEmpresa || 'ALL';
    await supabase.from('revenue_forecast_log').insert({
      empresa: empresaLog,
      forecast_date: new Date().toISOString().split('T')[0],
      horizonte_dias: 90,
      pessimista: forecast90d.pessimista,
      realista: forecast90d.realista,
      otimista: forecast90d.otimista,
      detalhes: result,
      features: { deal_features: dealFeatures.slice(0, 20), ai_narrative: aiNarrative },
    } as any);

    console.log('[RevenueForecast] Done with feature engineering:', JSON.stringify({ deals: openDeals.length, features: dealFeatures.length, hasAI: !!aiNarrative }));

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[RevenueForecast] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
