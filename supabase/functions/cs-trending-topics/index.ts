import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-provider.ts";
import { createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('cs-trending-topics');
const corsHeaders = getWebhookCorsHeaders();

const EMPRESAS = ['BLUE', 'TOKENIZA'] as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createServiceClient();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const allResults: Record<string, unknown> = {};

    for (const empresa of EMPRESAS) {
      const { data: surveys, error } = await supabase.from('cs_surveys').select('tipo, nota, texto_resposta, empresa')
        .eq('empresa', empresa)
        .not('texto_resposta', 'is', null)
        .gte('respondido_em', ninetyDaysAgo)
        .limit(200);
      if (error) throw error;

      if (!surveys || surveys.length === 0) {
        allResults[empresa] = { topics: [], wordCloud: [], message: 'No survey responses found' };
        continue;
      }

      const responsesText = surveys.map((s) => `[${s.tipo}] Nota: ${s.nota ?? 'N/A'} — "${s.texto_resposta}"`).join('\n');

      const aiResult = await callAI({
        system: 'Você é um analista de Customer Success. Analise respostas de pesquisas NPS/CSAT/CES e extraia insights estruturados. Responda em português. Retorne APENAS JSON válido sem markdown.',
        prompt: `Analise estas ${surveys.length} respostas:\n\n${responsesText}\n\nRetorne JSON: {"topics":[{"tema":"string","frequencia":number,"sentimento":"positivo|neutro|negativo","resumo":"string"}],"wordCloud":[{"palavra":"string","contagem":number}]}\n\nTop 5 temas e 20 palavras-chave.`,
        functionName: 'cs-trending-topics',
        empresa,
        supabase,
      });

      let result = { topics: [], wordCloud: [] };
      if (aiResult.content) {
        try { result = JSON.parse(aiResult.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch { /* ignore */ }
      }

      // Save per-tenant
      await supabase.from('system_settings').upsert(
        { key: `cs.trending_topics.${empresa}`, value: { ...result, updated_at: new Date().toISOString(), total_responses: surveys.length } },
        { onConflict: 'key' }
      );

      allResults[empresa] = result;
    }

    return new Response(JSON.stringify(allResults), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    log.error('Error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
