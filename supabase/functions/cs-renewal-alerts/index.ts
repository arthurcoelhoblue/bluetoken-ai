import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    const milestones = [60, 30, 15];
    let notified = 0;

    for (const days of milestones) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);
      const dateStr = targetDate.toISOString().split('T')[0];

      // Find customers with renewal on this date
      const { data: customers } = await supabase
        .from('cs_customers')
        .select('id, csm_id, empresa, valor_mrr, health_score, health_status, contacts(nome)')
        .eq('is_active', true)
        .gte('proxima_renovacao', `${dateStr}T00:00:00`)
        .lt('proxima_renovacao', `${dateStr}T23:59:59`);

      if (!customers || customers.length === 0) continue;

      for (const customer of customers) {
        if (!customer.csm_id) continue;

        // Check if notification already sent for this milestone
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('referencia_id', customer.id)
          .eq('tipo', 'CS_RENEWAL_ALERT')
          .like('mensagem', `%${days} dias%`)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const urgente = customer.health_status === 'EM_RISCO' || customer.health_status === 'CRITICO';
        const contactName = (customer as any).contacts?.nome || 'Cliente';

        await supabase.from('notifications').insert({
          user_id: customer.csm_id,
          empresa: customer.empresa,
          titulo: `${urgente ? '🚨' : '📅'} Renovação em ${days} dias: ${contactName}`,
          mensagem: `Renovação em ${days} dias. MRR: R$ ${customer.valor_mrr || 0}. Health: ${customer.health_score || 'N/A'}/100 (${customer.health_status || 'N/A'}).`,
          tipo: 'CS_RENEWAL_ALERT',
          referencia_tipo: 'CS_CUSTOMER',
          referencia_id: customer.id,
        });

        notified++;
      }
    }

    return new Response(
      JSON.stringify({ notified, milestones }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[CS-Renewal] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
