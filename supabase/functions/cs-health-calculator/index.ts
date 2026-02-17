import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-provider.ts";
import { createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getWebhookCorsHeaders } from "../_shared/cors.ts";
import { EMPRESAS } from "../_shared/tenant.ts";

const log = createLogger('cs-health-calculator');
const corsHeaders = getWebhookCorsHeaders();

type HealthStatus = 'SAUDAVEL' | 'ATENCAO' | 'EM_RISCO' | 'CRITICO';
interface Dimensoes { nps: number; csat: number; engajamento: number; financeiro: number; tempo: number; sentimento: number; }
interface IdRow { id: string }
interface NotaRow { nota: number }
interface StatusRow { status: string }
interface SentimentRow { sentiment_score: number }

function getStatus(score: number): HealthStatus {
  if (score >= 75) return 'SAUDAVEL';
  if (score >= 55) return 'ATENCAO';
  if (score >= 35) return 'EM_RISCO';
  return 'CRITICO';
}

function calcWeighted(d: Dimensoes): number {
  return Math.round(d.nps * 0.20 + d.csat * 0.15 + d.engajamento * 0.20 + d.financeiro * 0.20 + d.tempo * 0.10 + d.sentimento * 0.15);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createServiceClient();

    let customerIds: string[] = [];
    const body = req.method === 'POST' ? await req.json() : {};
    const singleId = body.customer_id as string | undefined;

    if (singleId) customerIds = [singleId];
    else {
      // forEachEmpresa: buscar customers filtrados por empresa
      for (const empresa of EMPRESAS) {
        const { data } = await supabase.from('cs_customers').select('id').eq('is_active', true).eq('empresa', empresa);
        customerIds.push(...(data ?? []).map((c: IdRow) => c.id));
      }
    }

    if (customerIds.length === 0) return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let processed = 0, errors = 0;

    for (const customerId of customerIds) {
      try {
        const { data: customer } = await supabase.from('cs_customers').select('id, contact_id, empresa, health_score, health_status, data_primeiro_ganho, csm_id').eq('id', customerId).single();
        if (!customer) continue;

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const [npsRes, csatRes, engagementRes, dealsRes, sentimentRes] = await Promise.all([
          supabase.from('cs_surveys').select('nota').eq('customer_id', customerId).eq('tipo', 'NPS').not('nota', 'is', null).order('respondido_em', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('cs_surveys').select('nota').eq('customer_id', customerId).eq('tipo', 'CSAT').not('nota', 'is', null).order('respondido_em', { ascending: false }).limit(3),
          supabase.from('deal_activities').select('id, deal_id').gte('created_at', thirtyDaysAgo).in('deal_id', (await supabase.from('deals').select('id').eq('contact_id', customer.contact_id)).data?.map((d: IdRow) => d.id) || []),
          supabase.from('deals').select('id, status').eq('contact_id', customer.contact_id),
          supabase.from('cs_surveys').select('sentiment_score').eq('customer_id', customerId).not('sentiment_score', 'is', null).order('respondido_em', { ascending: false }).limit(10),
        ]);

        const npsScore = npsRes.data?.nota != null ? npsRes.data.nota * 10 : 50;
        const csatData = csatRes.data ?? [];
        const csatScore = csatData.length > 0 ? (csatData.reduce((s: number, r: NotaRow) => s + r.nota, 0) / csatData.length) * 20 : 50;
        const actCount = engagementRes.data?.length ?? 0;
        const engajamentoScore = actCount === 0 ? 0 : actCount <= 3 ? 40 : actCount <= 8 ? 70 : 100;
        const allDeals = dealsRes.data ?? [];
        const financeiroScore = allDeals.length > 0 ? (allDeals.filter((d: StatusRow) => d.status === 'GANHO').length / allDeals.length) * 100 : 50;
        let tempoScore = 50;
        if (customer.data_primeiro_ganho) tempoScore = Math.min((Date.now() - new Date(customer.data_primeiro_ganho).getTime()) / (1000 * 60 * 60 * 24 * 30) / 24, 1) * 100;
        const sentData = sentimentRes.data ?? [];
        const sentimentoScore = sentData.length > 0 ? (sentData.reduce((s: number, r: SentimentRow) => s + r.sentiment_score, 0) / sentData.length) * 100 : 50;

        const dimensoes: Dimensoes = { nps: Math.round(npsScore), csat: Math.round(csatScore), engajamento: engajamentoScore, financeiro: Math.round(financeiroScore), tempo: Math.round(tempoScore), sentimento: Math.round(sentimentoScore) };
        const newScore = calcWeighted(dimensoes);
        const newStatus = getStatus(newScore);
        const oldScore = customer.health_score;
        const oldStatus = customer.health_status;

        if (oldScore !== newScore) {
          let motivo: string | null = oldStatus !== newStatus ? `Status mudou de ${oldStatus || 'N/A'} para ${newStatus}` : null;

          // Generate AI narrative when status changes
          if (oldStatus && oldStatus !== newStatus) {
            const aiResult = await callAI({
              system: 'Você é a Amélia, consultora de CS. Explique mudanças de health score em 1-2 frases.',
              prompt: `Health score mudou de ${oldScore ?? '?'} (${oldStatus}) para ${newScore} (${newStatus}). Dimensões: NPS=${dimensoes.nps}/100, CSAT=${dimensoes.csat}/100, Engajamento=${dimensoes.engajamento}/100, Financeiro=${dimensoes.financeiro}/100, Tempo=${dimensoes.tempo}/100, Sentimento=${dimensoes.sentimento}/100. Explique quais dimensões causaram a mudança. Responda apenas texto, sem formatação.`,
              functionName: 'cs-health-calculator',
              empresa: customer.empresa,
              maxTokens: 200,
              supabase,
            });
            if (aiResult.content) motivo = aiResult.content;
          }

          await supabase.from('cs_health_log').insert({ customer_id: customerId, score: newScore, status: newStatus, dimensoes: dimensoes as Record<string, number>, motivo_mudanca: motivo });
        }

        await supabase.from('cs_customers').update({ health_score: newScore, health_status: newStatus, updated_at: new Date().toISOString() }).eq('id', customerId);

        if (oldStatus && oldStatus !== newStatus && customer.csm_id) {
          const statusOrder = ['SAUDAVEL', 'ATENCAO', 'EM_RISCO', 'CRITICO'];
          if (statusOrder.indexOf(newStatus) > statusOrder.indexOf(oldStatus)) {
            await supabase.from('notifications').insert({ user_id: customer.csm_id, empresa: customer.empresa, titulo: `⚠️ Cliente CS mudou para ${newStatus}`, mensagem: `Health score: ${oldScore} → ${newScore}. Status: ${oldStatus} → ${newStatus}.`, tipo: 'CS_HEALTH_ALERT', referencia_tipo: 'CS_CUSTOMER', referencia_id: customerId });
          }
        }
        processed++;
      } catch (e) {
        log.error(`Erro no cliente ${customerId}`, { error: String(e) });
        errors++;
      }
    }

    return new Response(JSON.stringify({ processed, errors, total: customerIds.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    log.error('Erro geral', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
