import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-provider.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: surveys, error } = await supabase.from('cs_surveys').select('tipo, nota, texto_resposta, empresa').not('texto_resposta', 'is', null).gte('respondido_em', ninetyDaysAgo).limit(200);
    if (error) throw error;

    if (!surveys || surveys.length === 0) {
      return new Response(JSON.stringify({ topics: [], wordCloud: [], message: 'No survey responses found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const responsesText = surveys.map((s) => `[${s.tipo}] Nota: ${s.nota ?? 'N/A'} — "${s.texto_resposta}"`).join('\n');

    const aiResult = await callAI({
      system: 'Você é um analista de Customer Success. Analise respostas de pesquisas NPS/CSAT/CES e extraia insights estruturados. Responda em português. Retorne APENAS JSON válido sem markdown.',
      prompt: `Analise estas ${surveys.length} respostas:\n\n${responsesText}\n\nRetorne JSON: {"topics":[{"tema":"string","frequencia":number,"sentimento":"positivo|neutro|negativo","resumo":"string"}],"wordCloud":[{"palavra":"string","contagem":number}]}\n\nTop 5 temas e 20 palavras-chave.`,
      functionName: 'cs-trending-topics',
      empresa: surveys[0]?.empresa || null,
      supabase,
    });

    let result = { topics: [], wordCloud: [] };
    if (aiResult.content) {
      try { result = JSON.parse(aiResult.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch { /* ignore */ }
    }

    await supabase.from('system_settings').upsert({ key: 'cs.trending_topics', value: { ...result, updated_at: new Date().toISOString(), total_responses: surveys.length } }, { onConflict: 'key' });

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[CS-Trending-Topics] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
