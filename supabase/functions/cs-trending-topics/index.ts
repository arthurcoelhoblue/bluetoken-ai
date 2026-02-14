import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: surveys, error } = await supabase
      .from('cs_surveys')
      .select('tipo, nota, texto_resposta')
      .not('texto_resposta', 'is', null)
      .gte('respondido_em', ninetyDaysAgo)
      .limit(200);

    if (error) throw error;

    if (!surveys || surveys.length === 0) {
      return new Response(JSON.stringify({ topics: [], wordCloud: [], message: 'No survey responses found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const responsesText = surveys.map((s, i) => `[${s.tipo}] Nota: ${s.nota ?? 'N/A'} — "${s.texto_resposta}"`).join('\n');

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        temperature: 0.3,
        system: 'Você é um analista de Customer Success. Analise respostas de pesquisas NPS/CSAT/CES e extraia insights estruturados. Responda em português. Retorne APENAS JSON válido sem markdown.',
        messages: [{
          role: 'user',
          content: `Analise estas ${surveys.length} respostas de clientes:\n\n${responsesText}\n\nRetorne um JSON com:\n{"topics": [{"tema": "string", "frequencia": number, "sentimento": "positivo|neutro|negativo", "resumo": "string"}], "wordCloud": [{"palavra": "string", "contagem": number}]}\n\nTop 5 temas e 20 palavras-chave.`,
        }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('Anthropic error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, try again later' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`Anthropic error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.content?.[0]?.text ?? '';
    let result = { topics: [], wordCloud: [] };

    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error('[CS-Trending-Topics] Failed to parse AI response');
    }

    await supabase.from('system_settings').upsert({
      key: 'cs.trending_topics',
      value: { ...result, updated_at: new Date().toISOString(), total_responses: surveys.length },
    }, { onConflict: 'key' });

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[CS-Trending-Topics] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
