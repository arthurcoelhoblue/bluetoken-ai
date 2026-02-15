import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = getWebhookCorsHeaders();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all active customers
    const { data: customers, error: custErr } = await supabase
      .from('cs_customers')
      .select('id, health_score, health_status, ultimo_nps, ultimo_contato_em, csm_id, empresa, valor_mrr, risco_churn_pct')
      .eq('is_active', true);

    if (custErr) throw custErr;
    if (!customers || customers.length === 0) {
      return new Response(JSON.stringify({ updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let updated = 0;
    let alertsSent = 0;

    for (const customer of customers) {
      let riskScore = 0;

      // 1. Health score trend (weight: 30%)
      const { data: healthLogs } = await supabase
        .from('cs_health_log')
        .select('score, status')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (healthLogs && healthLogs.length >= 2) {
        const trend = healthLogs[0].score - healthLogs[healthLogs.length - 1].score;
        if (trend < -20) riskScore += 30;
        else if (trend < -10) riskScore += 20;
        else if (trend < 0) riskScore += 10;
        else riskScore += 0;
      } else {
        // Use current health status
        const statusRisk: Record<string, number> = {
          'CRITICO': 25, 'EM_RISCO': 18, 'ATENCAO': 8, 'SAUDAVEL': 2
        };
        riskScore += statusRisk[customer.health_status ?? 'ATENCAO'] ?? 10;
      }

      // 2. NPS trend (weight: 20%)
      if (customer.ultimo_nps != null) {
        if (customer.ultimo_nps <= 6) riskScore += 20;
        else if (customer.ultimo_nps <= 7) riskScore += 12;
        else if (customer.ultimo_nps <= 8) riskScore += 5;
        else riskScore += 0;
      } else {
        riskScore += 10; // No NPS = moderate risk
      }

      // 3. Days without contact (weight: 25%)
      if (customer.ultimo_contato_em) {
        const daysSinceContact = Math.floor(
          (Date.now() - new Date(customer.ultimo_contato_em).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceContact > 60) riskScore += 25;
        else if (daysSinceContact > 30) riskScore += 18;
        else if (daysSinceContact > 14) riskScore += 8;
        else riskScore += 0;
      } else {
        riskScore += 15;
      }

      // 4. Open incidents (weight: 25%)
      const { count: openIncidents } = await supabase
        .from('cs_incidents')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customer.id)
        .in('status', ['ABERTA', 'EM_ANDAMENTO']);

      const incCount = openIncidents ?? 0;
      if (incCount >= 3) riskScore += 25;
      else if (incCount >= 2) riskScore += 18;
      else if (incCount >= 1) riskScore += 10;
      else riskScore += 0;

      // Clamp 0-100
      riskScore = Math.min(100, Math.max(0, riskScore));

      // Update customer
      await supabase
        .from('cs_customers')
        .update({ risco_churn_pct: riskScore, updated_at: new Date().toISOString() })
        .eq('id', customer.id);

      updated++;

      // Alert CSM if risk > 70% and changed significantly
      if (riskScore > 70 && customer.csm_id && (customer.risco_churn_pct ?? 0) <= 70) {
        await supabase.from('notifications').insert({
          user_id: customer.csm_id,
          empresa: customer.empresa,
          tipo: 'CS_CHURN_RISK',
          titulo: '⚠️ Cliente com alto risco de churn',
          mensagem: `Cliente com risco de churn de ${riskScore}%. Health score: ${customer.health_score ?? 'N/A'}`,
          referencia_tipo: 'cs_customer',
          referencia_id: customer.id,
        });
        alertsSent++;
      }
    }

    return new Response(
      JSON.stringify({ updated, alertsSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[CS-Churn-Predictor] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
