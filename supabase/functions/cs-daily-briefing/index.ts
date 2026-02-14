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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all CSMs (users that have cs_customers assigned)
    const { data: csmRows } = await supabase
      .from('cs_customers')
      .select('csm_id')
      .eq('is_active', true)
      .not('csm_id', 'is', null);

    const csmIds = [...new Set((csmRows ?? []).map((r: any) => r.csm_id))];

    if (csmIds.length === 0) {
      return new Response(JSON.stringify({ briefings: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let briefings = 0;

    for (const csmId of csmIds) {
      // Gather data for this CSM
      const [customersRes, incidentsRes, renewalsRes] = await Promise.all([
        supabase
          .from('cs_customers')
          .select('id, health_score, health_status, valor_mrr, contacts(nome)')
          .eq('csm_id', csmId)
          .eq('is_active', true),
        supabase
          .from('cs_incidents')
          .select('titulo, gravidade, status, customer_id')
          .in('status', ['ABERTA', 'EM_ANDAMENTO'])
          .limit(20),
        supabase
          .from('cs_customers')
          .select('id, proxima_renovacao, valor_mrr, health_status, contacts(nome)')
          .eq('csm_id', csmId)
          .eq('is_active', true)
          .gte('proxima_renovacao', new Date().toISOString())
          .lte('proxima_renovacao', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const customers = customersRes.data ?? [];
      const incidents = (incidentsRes.data ?? []).filter((i: any) =>
        customers.some((c: any) => c.id === i.customer_id)
      );
      const renewals = renewalsRes.data ?? [];

      if (customers.length === 0) continue;

      // Build context for AI
      const healthDist: Record<string, number> = {};
      let totalMrr = 0;
      customers.forEach((c: any) => {
        healthDist[c.health_status || 'N/A'] = (healthDist[c.health_status || 'N/A'] || 0) + 1;
        totalMrr += c.valor_mrr || 0;
      });

      const contextText = `
Portfólio: ${customers.length} clientes, MRR total R$ ${totalMrr.toLocaleString('pt-BR')}
Distribuição Health: ${Object.entries(healthDist).map(([k, v]) => `${k}=${v}`).join(', ')}
Incidências abertas: ${incidents.length} (${incidents.filter((i: any) => i.gravidade === 'ALTA' || i.gravidade === 'CRITICA').length} alta/crítica)
Renovações próximas (30 dias): ${renewals.length} totalizando R$ ${renewals.reduce((s: number, r: any) => s + (r.valor_mrr || 0), 0).toLocaleString('pt-BR')}
Clientes em risco: ${customers.filter((c: any) => c.health_status === 'EM_RISCO' || c.health_status === 'CRITICO').map((c: any) => (c as any).contacts?.nome || 'N/A').join(', ') || 'Nenhum'}
      `.trim();

      // Call AI for briefing
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content: 'Você é a Amélia, assistente de Customer Success. Gere um briefing diário conciso em português brasileiro com: 1) Resumo do portfólio, 2) Alertas urgentes, 3) Top 3 ações recomendadas para hoje. Use bullets, seja direta e acionável. Máximo 300 palavras.'
              },
              { role: 'user', content: contextText },
            ],
            stream: false,
          }),
        });

        if (!aiResponse.ok) {
          console.warn(`[CS-Briefing] AI error for CSM ${csmId}: ${aiResponse.status}`);
          continue;
        }

        const aiData = await aiResponse.json();
        const briefingText = aiData.choices?.[0]?.message?.content || 'Briefing indisponível.';

        // Save as notification
        await supabase.from('notifications').insert({
          user_id: csmId,
          empresa: customers[0]?.empresa || 'BLUE',
          titulo: `📋 Briefing CS — ${new Date().toLocaleDateString('pt-BR')}`,
          mensagem: briefingText.substring(0, 1000),
          tipo: 'CS_BRIEFING',
          referencia_tipo: 'CS_BRIEFING',
          referencia_id: new Date().toISOString().split('T')[0],
        });

        briefings++;
      } catch (aiErr) {
        console.error(`[CS-Briefing] AI call failed for CSM ${csmId}:`, aiErr);
      }
    }

    return new Response(
      JSON.stringify({ briefings }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[CS-Daily-Briefing] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
