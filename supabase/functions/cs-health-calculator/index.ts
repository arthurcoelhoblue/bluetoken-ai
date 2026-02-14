import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type HealthStatus = 'SAUDAVEL' | 'ATENCAO' | 'EM_RISCO' | 'CRITICO';

interface Dimensoes {
  nps: number;
  csat: number;
  engajamento: number;
  financeiro: number;
  tempo: number;
  sentimento: number;
}

function getStatus(score: number): HealthStatus {
  if (score >= 75) return 'SAUDAVEL';
  if (score >= 55) return 'ATENCAO';
  if (score >= 35) return 'EM_RISCO';
  return 'CRITICO';
}

function calcWeighted(d: Dimensoes): number {
  return Math.round(
    d.nps * 0.20 +
    d.csat * 0.15 +
    d.engajamento * 0.20 +
    d.financeiro * 0.20 +
    d.tempo * 0.10 +
    d.sentimento * 0.15
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let customerIds: string[] = [];
    const body = req.method === 'POST' ? await req.json() : {};
    const singleId = body.customer_id as string | undefined;

    if (singleId) {
      customerIds = [singleId];
    } else {
      const { data } = await supabase
        .from('cs_customers')
        .select('id')
        .eq('is_active', true);
      customerIds = (data ?? []).map((c: any) => c.id);
    }

    if (customerIds.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let errors = 0;

    for (const customerId of customerIds) {
      try {
        // Fetch customer
        const { data: customer } = await supabase
          .from('cs_customers')
          .select('id, contact_id, empresa, health_score, health_status, data_primeiro_ganho, csm_id')
          .eq('id', customerId)
          .single();

        if (!customer) continue;

        // Fetch all dimension data in parallel
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const [npsRes, csatRes, engagementRes, dealsRes, sentimentRes] = await Promise.all([
          // NPS: last score
          supabase
            .from('cs_surveys')
            .select('nota')
            .eq('customer_id', customerId)
            .eq('tipo', 'NPS')
            .not('nota', 'is', null)
            .order('respondido_em', { ascending: false })
            .limit(1)
            .maybeSingle(),
          // CSAT: avg last 3
          supabase
            .from('cs_surveys')
            .select('nota')
            .eq('customer_id', customerId)
            .eq('tipo', 'CSAT')
            .not('nota', 'is', null)
            .order('respondido_em', { ascending: false })
            .limit(3),
          // Engagement: activities in last 30 days for deals of this contact
          supabase
            .from('deal_activities')
            .select('id, deal_id')
            .gte('created_at', thirtyDaysAgo)
            .in('deal_id', (await supabase
              .from('deals')
              .select('id')
              .eq('contact_id', customer.contact_id)
            ).data?.map((d: any) => d.id) || []),
          // Financial: deals won vs total
          supabase
            .from('deals')
            .select('id, status')
            .eq('contact_id', customer.contact_id),
          // Sentiment: avg sentiment_score from surveys
          supabase
            .from('cs_surveys')
            .select('sentiment_score')
            .eq('customer_id', customerId)
            .not('sentiment_score', 'is', null)
            .order('respondido_em', { ascending: false })
            .limit(10),
        ]);

        // Calculate each dimension
        // NPS (0-10 -> 0-100)
        const npsScore = npsRes.data?.nota != null ? npsRes.data.nota * 10 : 50;

        // CSAT (0-5 -> 0-100)
        const csatData = csatRes.data ?? [];
        const csatScore = csatData.length > 0
          ? (csatData.reduce((s: number, r: any) => s + r.nota, 0) / csatData.length) * 20
          : 50;

        // Engagement
        const actCount = engagementRes.data?.length ?? 0;
        const engajamentoScore = actCount === 0 ? 0 : actCount <= 3 ? 40 : actCount <= 8 ? 70 : 100;

        // Financial
        const allDeals = dealsRes.data ?? [];
        const financeiroScore = allDeals.length > 0
          ? (allDeals.filter((d: any) => d.status === 'GANHO').length / allDeals.length) * 100
          : 50;

        // Tempo
        let tempoScore = 50;
        if (customer.data_primeiro_ganho) {
          const months = (Date.now() - new Date(customer.data_primeiro_ganho).getTime()) / (1000 * 60 * 60 * 24 * 30);
          tempoScore = Math.min(months / 24, 1) * 100;
        }

        // Sentiment
        const sentData = sentimentRes.data ?? [];
        const sentimentoScore = sentData.length > 0
          ? (sentData.reduce((s: number, r: any) => s + r.sentiment_score, 0) / sentData.length) * 100
          : 50;

        const dimensoes: Dimensoes = {
          nps: Math.round(npsScore),
          csat: Math.round(csatScore),
          engajamento: engajamentoScore,
          financeiro: Math.round(financeiroScore),
          tempo: Math.round(tempoScore),
          sentimento: Math.round(sentimentoScore),
        };

        const newScore = calcWeighted(dimensoes);
        const newStatus = getStatus(newScore);
        const oldScore = customer.health_score;
        const oldStatus = customer.health_status;

        // Only log if score changed
        if (oldScore !== newScore) {
          const motivo = oldStatus !== newStatus
            ? `Status mudou de ${oldStatus || 'N/A'} para ${newStatus}`
            : null;

          await supabase.from('cs_health_log').insert({
            customer_id: customerId,
            score: newScore,
            status: newStatus,
            dimensoes: dimensoes as any,
            motivo_mudanca: motivo,
          });
        }

        // Update customer
        await supabase
          .from('cs_customers')
          .update({ health_score: newScore, health_status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', customerId);

        // Notify CSM if status crossed threshold
        if (oldStatus && oldStatus !== newStatus && customer.csm_id) {
          const statusOrder = ['SAUDAVEL', 'ATENCAO', 'EM_RISCO', 'CRITICO'];
          const worsened = statusOrder.indexOf(newStatus) > statusOrder.indexOf(oldStatus);
          if (worsened) {
            await supabase.from('notifications').insert({
              user_id: customer.csm_id,
              empresa: customer.empresa,
              titulo: `⚠️ Cliente CS mudou para ${newStatus}`,
              mensagem: `Health score: ${oldScore} → ${newScore}. Status: ${oldStatus} → ${newStatus}.`,
              tipo: 'CS_HEALTH_ALERT',
              referencia_tipo: 'CS_CUSTOMER',
              referencia_id: customerId,
            });
          }
        }

        processed++;
      } catch (e) {
        console.error(`[CS-Health] Erro no cliente ${customerId}:`, e);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ processed, errors, total: customerIds.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[CS-Health] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
