import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-provider.ts";
import { createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('revenue-forecast');

interface DealFeatures {
  deal_id: string; titulo: string; valor: number; dias_no_stage_atual: number;
  total_atividades: number; ultima_atividade_dias_atras: number | null;
  taxa_resposta: number | null; score_probabilidade: number;
  icp_score: number | null; temperatura: string | null; canal_principal: string | null;
}

interface ActivityRow {
  deal_id: string;
  created_at: string;
}

interface ClassificationRow {
  lead_id: string;
  score_interno: number | null;
  temperatura: string | null;
  icp: string | null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createServiceClient();

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* cron */ }
    const targetEmpresa = (body.empresa as string) || null;

    const [openDealsRes, csCustomersRes, wonDealsRes, lostDealsRes] = await Promise.all([
      (() => { let q = supabase.from('deals').select('id, titulo, valor, score_probabilidade, pipeline_id, stage_id, created_at, updated_at, contact_id, lead_id, pipeline_empresa').eq('status', 'ABERTO'); if (targetEmpresa) q = q.eq('pipeline_empresa', targetEmpresa); return q.limit(500); })(),
      (() => { let q = supabase.from('cs_customers').select('id, valor_mrr, risco_churn_pct, empresa').eq('is_active', true); if (targetEmpresa) q = q.eq('empresa', targetEmpresa); return q.limit(500); })(),
      (() => { let q = supabase.from('deals').select('id, titulo, valor, pipeline_id, created_at, data_ganho, pipeline_empresa').eq('status', 'GANHO').gte('data_ganho', new Date(Date.now() - 180 * 86400000).toISOString()); if (targetEmpresa) q = q.eq('pipeline_empresa', targetEmpresa); return q.limit(500); })(),
      (() => { let q = supabase.from('deals').select('id, valor, created_at, updated_at, pipeline_empresa').eq('status', 'PERDIDO').gte('updated_at', new Date(Date.now() - 180 * 86400000).toISOString()); if (targetEmpresa) q = q.eq('pipeline_empresa', targetEmpresa); return q.limit(500); })(),
    ]);

    const openDeals = openDealsRes.data ?? [];
    const csCustomers = csCustomersRes.data ?? [];
    const wonDeals = wonDealsRes.data ?? [];
    const lostDeals = lostDealsRes.data ?? [];

    // Feature engineering
    const dealIds = openDeals.map(d => d.id);
    const leadIds = openDeals.map(d => d.lead_id).filter(Boolean);
    const [activitiesRes] = await Promise.all([
      dealIds.length > 0 ? supabase.from('deal_activities').select('deal_id, created_at').in('deal_id', dealIds.slice(0, 100)) : { data: [] },
    ]);

    const activitiesByDeal: Record<string, ActivityRow[]> = {};
    for (const act of ((activitiesRes.data || []) as ActivityRow[])) {
      if (!activitiesByDeal[act.deal_id]) activitiesByDeal[act.deal_id] = [];
      activitiesByDeal[act.deal_id].push(act);
    }

    const classMap: Record<string, ClassificationRow> = {};
    if (leadIds.length > 0) {
      const { data: classifications } = await supabase.from('lead_classifications').select('lead_id, score_interno, temperatura, icp').in('lead_id', leadIds.slice(0, 100));
      for (const c of ((classifications || []) as ClassificationRow[])) classMap[c.lead_id] = c;
    }

    const now = Date.now();
    const dealFeatures: DealFeatures[] = openDeals.map(deal => {
      const activities = activitiesByDeal[deal.id] || [];
      const lastActivity = [...activities].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const classification = deal.lead_id ? classMap[deal.lead_id] : null;
      return {
        deal_id: deal.id, titulo: deal.titulo || '', valor: deal.valor || 0,
        dias_no_stage_atual: Math.floor((now - new Date(deal.updated_at).getTime()) / 86400000),
        total_atividades: activities.length,
        ultima_atividade_dias_atras: lastActivity ? Math.floor((now - new Date(lastActivity.created_at).getTime()) / 86400000) : null,
        taxa_resposta: null, score_probabilidade: deal.score_probabilidade || 30,
        icp_score: classification?.score_interno || null, temperatura: classification?.temperatura || null, canal_principal: null,
      };
    });

    let pipelineWeighted = 0, pipelineTotal = 0;
    for (const feat of dealFeatures) { pipelineWeighted += feat.valor * (feat.score_probabilidade / 100); pipelineTotal += feat.valor; }

    let mrrTotal = 0, mrrRetained = 0;
    for (const cust of csCustomers) { const mrr = cust.valor_mrr || 0; mrrTotal += mrr; mrrRetained += mrr * (1 - (cust.risco_churn_pct || 5) / 100); }

    const closeTimes = wonDeals.filter((d) => d.data_ganho && d.created_at).map((d) => (new Date(d.data_ganho).getTime() - new Date(d.created_at).getTime()) / 86400000);
    const avgCloseTime = closeTimes.length > 0 ? closeTimes.reduce((a: number, b: number) => a + b, 0) / closeTimes.length : 45;
    const avgDealValue = wonDeals.length > 0 ? wonDeals.reduce((s: number, d) => s + (d.valor || 0), 0) / wonDeals.length : 0;
    const avgWinRate = wonDeals.length > 0 ? wonDeals.length / (wonDeals.length + lostDeals.length) : 0.2;
    const pipelineVelocity = avgCloseTime > 0 ? (openDeals.length * avgDealValue * avgWinRate) / avgCloseTime : 0;

    // AI Narrative
    let aiNarrative: Record<string, unknown> | null = null;
    if (dealFeatures.length > 0) {
      const topDeals = dealFeatures.sort((a, b) => b.valor - a.valor).slice(0, 15);
      const wonPattern = `${wonDeals.length} deals ganhos nos últimos 180 dias, valor médio R$${Math.round(avgDealValue)}, tempo médio ${Math.round(avgCloseTime)} dias. Win rate: ${Math.round(avgWinRate * 100)}%.`;
      const dealsText = topDeals.map(d => `${d.titulo}: R$${d.valor}, ${d.dias_no_stage_atual}d no stage, ${d.total_atividades} atividades, score ${d.score_probabilidade}, temp ${d.temperatura || 'N/A'}`).join('\n');

      const aiResult = await callAI({
        system: 'Você é um analista de receita. Retorne APENAS JSON válido sem markdown.',
        prompt: `Analise deals abertos vs padrão de sucesso.\nPADRÃO: ${wonPattern}\nTOP DEALS:\n${dealsText}\nMRR: R$${Math.round(mrrTotal)}, Retido: R$${Math.round(mrrRetained)}\n\nJSON: {"analise_geral":"...","top_riscos":[...],"top_sinais_positivos":[...],"deals_destaque":[{"titulo":"...","probabilidade_ajustada":75,"justificativa":"..."}]}`,
        functionName: 'revenue-forecast',
        empresa: targetEmpresa,
        maxTokens: 1000,
        supabase,
      });

      if (aiResult.content) {
        try { const jsonMatch = aiResult.content.match(/\{[\s\S]*\}/); if (jsonMatch) aiNarrative = JSON.parse(jsonMatch[0]); } catch { /* ignore */ }
      }
    }

    const forecast30d = { pessimista: Math.round(pipelineWeighted * 0.6 + mrrRetained), realista: Math.round(pipelineWeighted + mrrRetained), otimista: Math.round(pipelineWeighted * 1.3 + mrrTotal) };
    const forecast90d = { pessimista: Math.round(forecast30d.pessimista * 2.5), realista: Math.round(forecast30d.realista * 2.8), otimista: Math.round(forecast30d.otimista * 3.2) };

    const result = {
      generated_at: new Date().toISOString(), pipeline_total: Math.round(pipelineTotal), pipeline_weighted: Math.round(pipelineWeighted),
      mrr_total: Math.round(mrrTotal), mrr_retained: Math.round(mrrRetained), arr_total: Math.round(mrrTotal * 12), arr_retained: Math.round(mrrRetained * 12),
      avg_close_days: Math.round(avgCloseTime), avg_deal_value: Math.round(avgDealValue), pipeline_velocity_daily: Math.round(pipelineVelocity),
      open_deals_count: openDeals.length, active_customers: csCustomers.length, win_rate: Math.round(avgWinRate * 100),
      forecast_30d: forecast30d, forecast_90d: forecast90d, ai_narrative: aiNarrative,
    };

    await supabase.from('system_settings').upsert({ key: 'revenue_forecast', value: result, updated_at: new Date().toISOString() } as Record<string, unknown>, { onConflict: 'key' });
    await supabase.from('revenue_forecast_log').insert({ empresa: targetEmpresa || 'ALL', forecast_date: new Date().toISOString().split('T')[0], horizonte_dias: 90, pessimista: forecast90d.pessimista, realista: forecast90d.realista, otimista: forecast90d.otimista, detalhes: result, features: { deal_features: dealFeatures.slice(0, 20), ai_narrative: aiNarrative } } as Record<string, unknown>);

    return new Response(JSON.stringify({ success: true, ...result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    log.error('Error', { error: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
