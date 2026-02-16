import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('cs-renewal-alerts');
const corsHeaders = getWebhookCorsHeaders();

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createServiceClient();
    const now = new Date();
    const milestones = [60, 30, 15];
    let notified = 0;

    for (const days of milestones) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);
      const dateStr = targetDate.toISOString().split('T')[0];

      const { data: customers } = await supabase
        .from('cs_customers')
        .select('id, csm_id, empresa, valor_mrr, health_score, health_status, contacts(nome)')
        .eq('is_active', true)
        .gte('proxima_renovacao', `${dateStr}T00:00:00`)
        .lt('proxima_renovacao', `${dateStr}T23:59:59`);

      if (!customers || customers.length === 0) continue;

      for (const customer of customers) {
        if (!customer.csm_id) continue;
        const { data: existing } = await supabase.from('notifications').select('id').eq('referencia_id', customer.id).eq('tipo', 'CS_RENEWAL_ALERT').like('mensagem', `%${days} dias%`).limit(1);
        if (existing && existing.length > 0) continue;

        const urgente = customer.health_status === 'EM_RISCO' || customer.health_status === 'CRITICO';
        const contactName = (customer as Record<string, unknown>).contacts && typeof (customer as Record<string, unknown>).contacts === 'object' ? ((customer as Record<string, unknown>).contacts as Record<string, unknown>)?.nome as string || 'Cliente' : 'Cliente';

        await supabase.from('notifications').insert({
          user_id: customer.csm_id, empresa: customer.empresa,
          titulo: `${urgente ? '🚨' : '📅'} Renovação em ${days} dias: ${contactName}`,
          mensagem: `Renovação em ${days} dias. MRR: R$ ${customer.valor_mrr || 0}. Health: ${customer.health_score || 'N/A'}/100 (${customer.health_status || 'N/A'}).`,
          tipo: 'CS_RENEWAL_ALERT', referencia_tipo: 'CS_CUSTOMER', referencia_id: customer.id,
        });
        notified++;
      }
    }

    return new Response(JSON.stringify({ notified, milestones }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    log.error('Erro', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
