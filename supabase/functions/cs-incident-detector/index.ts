import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('cs-incident-detector');
const corsHeaders = getWebhookCorsHeaders();

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createServiceClient();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    let detected = 0;

    const { data: customers } = await supabase
      .from('cs_customers').select('id, contact_id, csm_id, empresa, contacts(nome, legacy_lead_id)').eq('is_active', true);

    if (!customers || customers.length === 0) {
      return new Response(JSON.stringify({ detected: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    for (const customer of customers) {
      const leadId = (customer as Record<string, unknown>).contacts && typeof (customer as Record<string, unknown>).contacts === 'object' ? ((customer as Record<string, unknown>).contacts as Record<string, unknown>)?.legacy_lead_id as string : null;
      if (!leadId) continue;

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentIncidents } = await supabase.from('cs_incidents').select('id').eq('customer_id', customer.id).eq('detectado_por_ia', true).gte('created_at', twentyFourHoursAgo).limit(1);
      if (recentIncidents && recentIncidents.length > 0) continue;

      const { data: intents } = await supabase.from('lead_message_intents').select('sentimento, intent_summary, created_at').eq('lead_id', leadId).eq('empresa', customer.empresa).gte('created_at', fortyEightHoursAgo).order('created_at', { ascending: false }).limit(10);
      if (!intents || intents.length < 2) continue;

      let consecutiveNeg = 0;
      for (const intent of intents) { if (intent.sentimento === 'NEGATIVO') consecutiveNeg++; else break; }
      if (consecutiveNeg < 2) continue;

      const gravidade = consecutiveNeg >= 3 ? 'ALTA' : 'MEDIA';
      const contactName = (customer as Record<string, unknown>).contacts && typeof (customer as Record<string, unknown>).contacts === 'object' ? ((customer as Record<string, unknown>).contacts as Record<string, unknown>)?.nome as string || 'Cliente' : 'Cliente';

      await supabase.from('cs_incidents').insert({
        customer_id: customer.id, empresa: customer.empresa, tipo: 'RECLAMACAO', gravidade,
        titulo: `Sentimento negativo detectado: ${contactName}`,
        descricao: `IA detectou ${consecutiveNeg} mensagens consecutivas com sentimento negativo nas últimas 48h. Última: "${intents[0]?.intent_summary?.substring(0, 200) || '-'}"`,
        origem: 'IA_DETECTOR', status: 'ABERTA', responsavel_id: customer.csm_id, detectado_por_ia: true, impacto_health: consecutiveNeg >= 3 ? -15 : -10,
      });

      if (customer.csm_id) {
        await supabase.from('notifications').insert({
          user_id: customer.csm_id, empresa: customer.empresa,
          titulo: `⚠️ Sentimento negativo: ${contactName}`,
          mensagem: `${consecutiveNeg} mensagens negativas consecutivas detectadas. Gravidade: ${gravidade}.`,
          tipo: 'CS_INCIDENT_AUTO', referencia_tipo: 'CS_CUSTOMER', referencia_id: customer.id,
        });
      }
      detected++;
    }

    return new Response(JSON.stringify({ detected }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    log.error('Erro', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
