import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-provider.ts";
import { createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('cs-daily-briefing');
const corsHeaders = getWebhookCorsHeaders();

interface CSCustomerRow {
  id: string;
  health_score: number | null;
  health_status: string | null;
  valor_mrr: number | null;
  empresa: string | null;
  contacts: { nome: string } | null;
}

interface IncidentRow {
  titulo: string;
  gravidade: string;
  status: string;
  customer_id: string;
}

interface RenewalRow {
  id: string;
  proxima_renovacao: string | null;
  valor_mrr: number | null;
  health_status: string | null;
  contacts: { nome: string } | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createServiceClient();

    const { data: csmRows } = await supabase.from('cs_customers').select('csm_id').eq('is_active', true).not('csm_id', 'is', null);
    const csmIds = [...new Set((csmRows ?? []).map((r) => r.csm_id))];
    if (csmIds.length === 0) return new Response(JSON.stringify({ briefings: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let briefings = 0;

    for (const csmId of csmIds) {
      const [customersRes, renewalsRes] = await Promise.all([
        supabase.from('cs_customers').select('id, health_score, health_status, valor_mrr, empresa, contacts(nome)').eq('csm_id', csmId).eq('is_active', true),
        supabase.from('cs_customers').select('id, proxima_renovacao, valor_mrr, health_status, contacts(nome)').eq('csm_id', csmId).eq('is_active', true).gte('proxima_renovacao', new Date().toISOString()).lte('proxima_renovacao', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const customers = (customersRes.data ?? []) as unknown as CSCustomerRow[];
      if (customers.length === 0) continue;

      // Resolve empresa from CSM's customers and filter incidents by it
      const csmEmpresa = customers[0]?.empresa;
      const customerIds = customers.map((c) => c.id);
      const { data: incidentsData } = await supabase.from('cs_incidents').select('titulo, gravidade, status, customer_id')
        .in('status', ['ABERTA', 'EM_ANDAMENTO'])
        .in('customer_id', customerIds)
        .eq('empresa', csmEmpresa || '')
        .limit(20);
      const incidents = (incidentsData ?? []) as unknown as IncidentRow[];
      const renewals = (renewalsRes.data ?? []) as unknown as RenewalRow[];

      const healthDist: Record<string, number> = {};
      let totalMrr = 0;
      customers.forEach((c) => { healthDist[c.health_status || 'N/A'] = (healthDist[c.health_status || 'N/A'] || 0) + 1; totalMrr += c.valor_mrr || 0; });

      const contextText = `Portfólio: ${customers.length} clientes, MRR total R$ ${totalMrr.toLocaleString('pt-BR')}
Distribuição Health: ${Object.entries(healthDist).map(([k, v]) => `${k}=${v}`).join(', ')}
Incidências abertas: ${incidents.length} (${incidents.filter((i) => i.gravidade === 'ALTA' || i.gravidade === 'CRITICA').length} alta/crítica)
Renovações próximas (30 dias): ${renewals.length} totalizando R$ ${renewals.reduce((s: number, r) => s + (r.valor_mrr || 0), 0).toLocaleString('pt-BR')}
Clientes em risco: ${customers.filter((c) => c.health_status === 'EM_RISCO' || c.health_status === 'CRITICO').map((c) => c.contacts?.nome || 'N/A').join(', ') || 'Nenhum'}`;

      const aiResult = await callAI({
        system: 'Você é a Amélia, assistente de Customer Success. Gere um briefing diário conciso em português brasileiro com: 1) Resumo do portfólio, 2) Alertas urgentes, 3) Top 3 ações recomendadas para hoje. Use bullets, seja direta e acionável. Máximo 300 palavras.',
        prompt: contextText,
        functionName: 'cs-daily-briefing',
        empresa: customers[0]?.empresa || null,
        temperature: 0.4,
        maxTokens: 1000,
        supabase,
      });

      if (aiResult.content) {
        await supabase.from('notifications').insert({ user_id: csmId, empresa: customers[0]?.empresa || 'BLUE', titulo: `📋 Briefing CS — ${new Date().toLocaleDateString('pt-BR')}`, mensagem: aiResult.content.substring(0, 1000), tipo: 'CS_BRIEFING', referencia_tipo: 'CS_BRIEFING', referencia_id: new Date().toISOString().split('T')[0] });
        briefings++;
      }
    }

    return new Response(JSON.stringify({ briefings }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    log.error('Erro', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
