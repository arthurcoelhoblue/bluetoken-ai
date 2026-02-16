import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('reclassify-leads');
const corsHeaders = getWebhookCorsHeaders();

const HIGH_CONFIDENCE_INTENTS = [
  'INTERESSE_COMPRA', 'INTERESSE_IR', 'AGENDAMENTO_REUNIAO',
  'PEDIDO_PROPOSTA', 'DECISAO_COMPRA', 'INTERESSE_PRODUTO',
];

const MEDIUM_CONFIDENCE_INTENTS = [
  'DUVIDA_PRODUTO', 'PEDIDO_INFORMACAO', 'INTERESSE_GENERICO',
  'FOLLOW_UP_POSITIVO',
];

interface ReclassifyResult {
  lead_id: string;
  empresa: string;
  before: { icp: string; prioridade: number; score_interno: number };
  after: { icp: string; prioridade: number; score_interno: number };
  best_intent: string;
  best_confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createServiceClient();

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun === true;
    const limit = body.limit || 500;

    // 1. Fetch hot leads with poor classification
    const { data: leads, error: leadsErr } = await supabase
      .from('lead_classifications')
      .select('lead_id, empresa, icp, prioridade, score_interno, origem, temperatura')
      .eq('temperatura', 'QUENTE')
      .neq('origem', 'MANUAL')
      .in('icp', ['BLUE_NAO_CLASSIFICADO', 'TOKENIZA_NAO_CLASSIFICADO'])
      .limit(limit);

    if (leadsErr) throw leadsErr;
    if (!leads?.length) {
      return new Response(JSON.stringify({ message: 'Nenhum lead para reclassificar', total: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: ReclassifyResult[] = [];
    const errors: string[] = [];

    for (const lead of leads) {
      try {
        // 2. Get best intent for this lead
        const { data: intents } = await supabase
          .from('lead_message_intents')
          .select('intent, intent_confidence')
          .eq('lead_id', lead.lead_id)
          .gte('intent_confidence', 0.7)
          .order('intent_confidence', { ascending: false })
          .limit(5);

        if (!intents?.length) continue;

        const bestIntent = intents[0];
        const intentName = bestIntent.intent as string;
        const confidence = bestIntent.intent_confidence as number;

        const before = {
          icp: lead.icp || 'NAO_CLASSIFICADO',
          prioridade: lead.prioridade || 3,
          score_interno: lead.score_interno || 20,
        };

        let newIcp = before.icp;
        let newPrioridade = before.prioridade;
        let newScore = before.score_interno;

        if (confidence >= 0.8 && HIGH_CONFIDENCE_INTENTS.includes(intentName)) {
          // High confidence upgrade
          const empresaStr = (lead.empresa || '').toString().toUpperCase();
          if (empresaStr.includes('TOKENIZA')) {
            newIcp = 'TOKENIZA_EMERGENTE';
          } else {
            newIcp = 'BLUE_ALTO_TICKET_IR';
          }
          newPrioridade = 1;
          newScore = Math.max(before.score_interno, 70 + Math.round((confidence - 0.8) * 100));
        } else if (confidence >= 0.7 && (HIGH_CONFIDENCE_INTENTS.includes(intentName) || MEDIUM_CONFIDENCE_INTENTS.includes(intentName))) {
          // Medium confidence upgrade
          newPrioridade = Math.min(before.prioridade, 2);
          newScore = Math.max(before.score_interno, before.score_interno + 20);
        } else {
          continue;
        }

        // Skip if nothing changed
        if (newIcp === before.icp && newPrioridade === before.prioridade && newScore === before.score_interno) continue;

        const after = { icp: newIcp, prioridade: newPrioridade, score_interno: Math.min(newScore, 100) };

        if (!dryRun) {
          await supabase
            .from('lead_classifications')
            .update({
              icp: after.icp,
              prioridade: after.prioridade,
              score_interno: after.score_interno,
              updated_at: new Date().toISOString(),
            })
            .eq('lead_id', lead.lead_id)
            .eq('empresa', lead.empresa)
            .neq('origem', 'MANUAL');
        }

        results.push({
          lead_id: lead.lead_id,
          empresa: lead.empresa,
          before,
          after,
          best_intent: intentName,
          best_confidence: confidence,
        });
      } catch (e) {
        errors.push(`${lead.lead_id}: ${String(e)}`);
      }
    }

    return new Response(JSON.stringify({
      dryRun,
      total_scanned: leads.length,
      total_upgraded: results.length,
      errors: errors.length,
      error_details: errors.slice(0, 10),
      results: results.slice(0, 50),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log.error('Error', { error: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
