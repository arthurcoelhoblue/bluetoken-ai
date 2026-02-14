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
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    // Fetch survey responses with text from last 90 days
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

    const responsesText = surveys.map((s, i) =>
      `[${s.tipo}] Nota: ${s.nota ?? 'N/A'} — "${s.texto_resposta}"`
    ).join('\n');

    // Call Lovable AI with tool calling for structured output
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'Você é um analista de Customer Success. Analise respostas de pesquisas NPS/CSAT/CES e extraia insights estruturados. Responda em português.'
          },
          {
            role: 'user',
            content: `Analise estas ${surveys.length} respostas de clientes:\n\n${responsesText}\n\nExtraia:\n1) Top 5 temas recorrentes com frequência estimada\n2) Sentimento geral por tema (positivo/neutro/negativo)\n3) As 20 palavras-chave mais citadas com contagem estimada`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_trending_topics',
            description: 'Extract trending topics and word cloud from survey responses',
            parameters: {
              type: 'object',
              properties: {
                topics: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tema: { type: 'string' },
                      frequencia: { type: 'number' },
                      sentimento: { type: 'string', enum: ['positivo', 'neutro', 'negativo'] },
                      resumo: { type: 'string' }
                    },
                    required: ['tema', 'frequencia', 'sentimento', 'resumo']
                  }
                },
                wordCloud: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      palavra: { type: 'string' },
                      contagem: { type: 'number' }
                    },
                    required: ['palavra', 'contagem']
                  }
                }
              },
              required: ['topics', 'wordCloud']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_trending_topics' } }
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, try again later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result = { topics: [], wordCloud: [] };

    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    }

    // Save to system_settings
    await supabase.from('system_settings').upsert({
      key: 'cs.trending_topics',
      value: { ...result, updated_at: new Date().toISOString(), total_responses: surveys.length },
    }, { onConflict: 'key' });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[CS-Trending-Topics] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
