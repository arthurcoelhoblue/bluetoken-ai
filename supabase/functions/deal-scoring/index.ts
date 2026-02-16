import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-provider.ts";
import { createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('deal-scoring');

interface DealRow {
  id: string;
  titulo: string;
  valor: number | null;
  temperatura: string | null;
  status: string;
  stage_id: string | null;
  pipeline_id: string;
  owner_id: string | null;
  contact_id: string | null;
  score_probabilidade: number | null;
  updated_at: string;
  created_at: string;
  pipeline_stages: { id: string; nome: string; posicao: number; pipeline_id: string } | null;
  contacts: { id: string; nome: string; legacy_lead_id: string | null } | null;
}

interface StageRow {
  id: string;
  posicao: number;
  pipeline_id: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createServiceClient();

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty body = batch mode */ }
    const targetDealId = (body?.deal_id as string) || null;
    const empresa = (body?.empresa as string) || null;

    // Fetch deals to score — filter by pipeline empresa when provided
    let query = supabase.from('deals').select(`
      id, titulo, valor, temperatura, status, stage_id, pipeline_id, owner_id,
      contact_id, score_probabilidade, updated_at, created_at,
      pipeline_stages!deals_stage_id_fkey(id, nome, posicao, pipeline_id),
      contacts(id, nome, legacy_lead_id)
    `).eq('status', 'ABERTO');

    if (targetDealId) {
      query = query.eq('id', targetDealId);
    } else {
      // In batch mode, filter by empresa via pipelines join
      if (empresa) {
        const { data: pipelines } = await supabase.from('pipelines').select('id').eq('empresa', empresa);
        const pipelineIds = (pipelines ?? []).map(p => p.id);
        if (pipelineIds.length > 0) {
          query = query.in('pipeline_id', pipelineIds);
        } else {
          return new Response(JSON.stringify({ scored: 0, empresa }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
      query = query.limit(200);
    }

    const { data: deals, error: dealsErr } = await query;
    if (dealsErr) throw dealsErr;
    if (!deals || deals.length === 0) {
      return new Response(JSON.stringify({ scored: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const typedDeals = deals as unknown as DealRow[];
    const pipelineIds = [...new Set(typedDeals.map((d) => d.pipeline_id))];
    const [stagesRes] = await Promise.all([
      supabase.from('pipeline_stages').select('id, posicao, pipeline_id').in('pipeline_id', pipelineIds).order('posicao'),
    ]);

    const stagesByPipeline: Record<string, StageRow[]> = {};
    for (const s of (stagesRes.data ?? []) as StageRow[]) {
      if (!stagesByPipeline[s.pipeline_id]) stagesByPipeline[s.pipeline_id] = [];
      stagesByPipeline[s.pipeline_id].push(s);
    }

    const { data: wonDeals } = await supabase.from('deals').select('pipeline_id, valor').eq('status', 'GANHO').in('pipeline_id', pipelineIds).not('valor', 'is', null).limit(500);
    const avgTicket: Record<string, number> = {};
    if (wonDeals) {
      const sums: Record<string, { total: number; count: number }> = {};
      for (const d of wonDeals) {
        if (!sums[d.pipeline_id]) sums[d.pipeline_id] = { total: 0, count: 0 };
        sums[d.pipeline_id].total += d.valor || 0;
        sums[d.pipeline_id].count++;
      }
      for (const [pid, s] of Object.entries(sums)) avgTicket[pid] = s.count > 0 ? s.total / s.count : 0;
    }

    const { data: stageHistAvg } = await supabase.from('deal_stage_history').select('to_stage_id, tempo_no_stage_anterior_ms').not('tempo_no_stage_anterior_ms', 'is', null).limit(2000);
    const stageAvgTime: Record<string, number> = {};
    if (stageHistAvg) {
      const groups: Record<string, number[]> = {};
      for (const h of stageHistAvg) {
        if (!groups[h.to_stage_id]) groups[h.to_stage_id] = [];
        groups[h.to_stage_id].push(h.tempo_no_stage_anterior_ms);
      }
      for (const [sid, times] of Object.entries(groups)) stageAvgTime[sid] = times.reduce((a, b) => a + b, 0) / times.length;
    }

    const results: Array<{ deal_id: string; score?: number; proxima_acao?: string | null; error?: string }> = [];

    for (const deal of typedDeals) {
      try {
        const stages = stagesByPipeline[deal.pipeline_id] || [];
        const totalStages = stages.length;
        const stagePos = deal.pipeline_stages?.posicao ?? 1;
        const stageProgress = totalStages > 1 ? ((stagePos - 1) / (totalStages - 1)) * 100 : 50;
        const daysInStage = (Date.now() - new Date(deal.updated_at).getTime()) / 86400000;
        const avgMs = deal.stage_id ? stageAvgTime[deal.stage_id] : undefined;
        const avgDays = avgMs ? avgMs / 86400000 : 14;
        let tempoScore = 100;
        if (avgDays > 0) tempoScore = daysInStage > avgDays * 2 ? 0 : Math.max(0, 100 - (daysInStage / avgDays) * 50);

        const { data: activities } = await supabase.from('deal_activities').select('tipo').eq('deal_id', deal.id).gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString());
        let engPoints = 0;
        for (const a of activities ?? []) {
          if (a.tipo === 'REUNIAO') engPoints += 3;
          else if (a.tipo === 'CALL') engPoints += 2;
          else engPoints += 1;
        }
        const engajamento = Math.min(100, engPoints * 10);

        let temperaturaScore = 50;
        const temp = deal.temperatura;
        if (temp === 'QUENTE') temperaturaScore = 100;
        else if (temp === 'MORNO') temperaturaScore = 60;
        else if (temp === 'FRIO') temperaturaScore = 20;

        const legacyLeadId = deal.contacts?.legacy_lead_id;
        if (legacyLeadId) {
          const { data: classif } = await supabase.from('lead_classifications').select('icp').eq('lead_id', legacyLeadId).order('created_at', { ascending: false }).limit(1);
          if (classif?.[0]?.icp === 'ICP_A') temperaturaScore = Math.min(100, temperaturaScore + 20);
          else if (classif?.[0]?.icp === 'ICP_B') temperaturaScore = Math.min(100, temperaturaScore + 10);
        }

        const ticket = avgTicket[deal.pipeline_id] || 0;
        let valorScore = 50;
        if (ticket > 0 && deal.valor) {
          const ratio = deal.valor / ticket;
          if (ratio >= 0.5 && ratio <= 1.5) valorScore = 100;
          else if (ratio > 3) valorScore = 20;
          else valorScore = 60;
        }

        let sentimentoScore = 50;
        if (legacyLeadId) {
          const { data: intents } = await supabase.from('lead_message_intents').select('intent').eq('lead_id', legacyLeadId).order('created_at', { ascending: false }).limit(1);
          const lastIntent = intents?.[0]?.intent;
          if (['INTERESSE_COMPRA', 'AGENDAMENTO_REUNIAO', 'SOLICITACAO_CONTATO'].includes(lastIntent)) sentimentoScore = 100;
          else if (['DUVIDA', 'INFORMACAO'].includes(lastIntent)) sentimentoScore = 60;
          else if (['OBJECAO', 'RECLAMACAO'].includes(lastIntent)) sentimentoScore = 20;
        }

        const score = Math.round(stageProgress * 0.25 + tempoScore * 0.20 + engajamento * 0.20 + temperaturaScore * 0.15 + valorScore * 0.10 + sentimentoScore * 0.10);
        const finalScore = Math.max(1, Math.min(99, score));

        const dimensoes = {
          stage_progress: Math.round(stageProgress), tempo_stage: Math.round(tempoScore),
          engajamento: Math.round(engajamento), temperatura: Math.round(temperaturaScore),
          valor_vs_ticket: Math.round(valorScore), sentimento: Math.round(sentimentoScore),
          dias_na_stage: Math.round(daysInStage), media_stage_dias: Math.round(avgDays),
        };

        // Generate proxima_acao_sugerida via shared AI provider
        let proximaAcao: string | null = null;
        if (targetDealId || finalScore < 50) {
          const aiResult = await callAI({
            system: 'Você sugere a próxima ação para um vendedor. Responda com UMA frase curta e acionável em português. Sem markdown.',
            prompt: `Deal "${deal.titulo}" (R$ ${deal.valor || 0}). Stage: ${deal.pipeline_stages?.nome}. ${Math.round(daysInStage)} dias na stage (média ${Math.round(avgDays)}d). Temperatura: ${temp || 'N/A'}. Engajamento 14d: ${activities?.length || 0} atividades. Score: ${finalScore}/100. Dimensões: ${JSON.stringify(dimensoes)}. Qual a próxima ação mais importante?`,
            functionName: 'deal-scoring',
            maxTokens: 100,
            supabase,
          });
          if (aiResult.content) proximaAcao = aiResult.content;
        }

        await supabase.from('deals').update({
          score_probabilidade: finalScore, scoring_dimensoes: dimensoes,
          proxima_acao_sugerida: proximaAcao, scoring_updated_at: new Date().toISOString(),
        } as Record<string, unknown>).eq('id', deal.id);

        results.push({ deal_id: deal.id, score: finalScore, proxima_acao: proximaAcao });
      } catch (dealErr) {
        log.error(`Error on deal ${deal.id}`, { error: String(dealErr) });
        results.push({ deal_id: deal.id, error: String(dealErr) });
      }
    }

    return new Response(JSON.stringify({ scored: results.length, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    log.error('Error', { error: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
