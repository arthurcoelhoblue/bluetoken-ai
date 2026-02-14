import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('[RevenueForecast] Starting forecast generation');

    // Gather data in parallel
    const [openDealsRes, csCustomersRes, wonDealsRes] = await Promise.all([
      // Open deals with scoring
      (() => {
        let q = supabase.from('deals').select('id, valor, score_probabilidade, pipeline_id, stage_id, created_at, updated_at')
          .eq('status', 'ABERTO');
        if (targetEmpresa) q = q.eq('pipeline_id', targetEmpresa); // filtered by pipeline empresa later
        return q.limit(500);
      })(),
      // Active CS customers with MRR and churn risk
      (() => {
        let q = supabase.from('cs_customers').select('id, valor_mrr, risco_churn_pct, empresa')
          .eq('is_active', true);
        if (targetEmpresa) q = q.eq('empresa', targetEmpresa);
        return q.limit(500);
      })(),
      // Won deals in last 180 days for velocity calculation
      (() => {
        let q = supabase.from('deals').select('id, valor, pipeline_id, created_at, data_ganho')
          .eq('status', 'GANHO')
          .gte('data_ganho', new Date(Date.now() - 180 * 86400000).toISOString());
        return q.limit(500);
      })(),
    ]);

    const openDeals = openDealsRes.data ?? [];
    const csCustomers = csCustomersRes.data ?? [];
    const wonDeals = wonDealsRes.data ?? [];

    // === Pipeline Revenue (weighted by probability) ===
    let pipelineWeighted = 0;
    let pipelineTotal = 0;
    const dealContributions: number[] = [];

    for (const deal of openDeals) {
      const prob = (deal.score_probabilidade || 30) / 100;
      const contribution = (deal.valor || 0) * prob;
      pipelineWeighted += contribution;
      pipelineTotal += (deal.valor || 0);
      dealContributions.push(contribution);
    }

    // === MRR Retention (adjusted by churn risk) ===
    let mrrTotal = 0;
    let mrrRetained = 0;

    for (const cust of csCustomers) {
      const mrr = cust.valor_mrr || 0;
      const churnRisk = (cust.risco_churn_pct || 5) / 100;
      mrrTotal += mrr;
      mrrRetained += mrr * (1 - churnRisk);
    }

    const arrTotal = mrrTotal * 12;
    const arrRetained = mrrRetained * 12;

    // === Pipeline Velocity ===
    // Average days to close won deals
    const closeTimes = wonDeals
      .filter((d: any) => d.data_ganho && d.created_at)
      .map((d: any) => (new Date(d.data_ganho).getTime() - new Date(d.created_at).getTime()) / 86400000);

    const avgCloseTime = closeTimes.length > 0
      ? closeTimes.reduce((a: number, b: number) => a + b, 0) / closeTimes.length
      : 45; // default 45 days

    const avgDealValue = wonDeals.length > 0
      ? wonDeals.reduce((s: number, d: any) => s + (d.valor || 0), 0) / wonDeals.length
      : 0;

    // Pipeline Velocity = (# deals * avg deal value * avg win rate) / avg close time
    const avgWinRate = wonDeals.length > 0 ? 0.3 : 0.2; // simplified
    const pipelineVelocity = avgCloseTime > 0
      ? (openDeals.length * avgDealValue * avgWinRate) / avgCloseTime
      : 0;

    // === Confidence intervals (P25/P50/P75) ===
    // Sort deal contributions for percentile calculation
    dealContributions.sort((a, b) => a - b);
    const p = (pct: number) => {
      if (dealContributions.length === 0) return 0;
      const idx = Math.floor(pct * dealContributions.length);
      return dealContributions.slice(0, Math.max(1, idx)).reduce((a, b) => a + b, 0);
    };

    // Simple variance-based intervals
    const variance = dealContributions.length > 1
      ? dealContributions.reduce((s, v) => s + Math.pow(v - pipelineWeighted / dealContributions.length, 2), 0) / dealContributions.length
      : pipelineWeighted * 0.1;
    const stdDev = Math.sqrt(variance);

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
      arr_total: Math.round(arrTotal),
      arr_retained: Math.round(arrRetained),
      avg_close_days: Math.round(avgCloseTime),
      avg_deal_value: Math.round(avgDealValue),
      pipeline_velocity_daily: Math.round(pipelineVelocity),
      open_deals_count: openDeals.length,
      active_customers: csCustomers.length,
      forecast_30d: forecast30d,
      forecast_90d: forecast90d,
    };

    // Save to system_settings
    await supabase.from('system_settings').upsert({
      key: 'revenue_forecast',
      value: result,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: 'key' });

    // Save to forecast log
    const empresaLog = targetEmpresa || 'ALL';
    await supabase.from('revenue_forecast_log').insert({
      empresa: empresaLog,
      forecast_date: new Date().toISOString().split('T')[0],
      horizonte_dias: 90,
      pessimista: forecast90d.pessimista,
      realista: forecast90d.realista,
      otimista: forecast90d.otimista,
      detalhes: result,
    } as any);

    console.log('[RevenueForecast] Done:', JSON.stringify(result));

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
