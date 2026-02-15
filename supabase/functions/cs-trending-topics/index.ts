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
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!GOOGLE_API_KEY && !ANTHROPIC_API_KEY) throw new Error('No AI API key configured');

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: surveys, error } = await supabase
      .from('cs_surveys')
      .select('tipo, nota, texto_resposta, empresa')
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

    const systemPrompt = 'Você é um analista de Customer Success. Analise respostas de pesquisas NPS/CSAT/CES e extraia insights estruturados. Responda em português. Retorne APENAS JSON válido sem markdown.';
    const userPrompt = `Analise estas ${surveys.length} respostas de clientes:\n\n${responsesText}\n\nRetorne um JSON com:\n{"topics": [{"tema": "string", "frequencia": number, "sentimento": "positivo|neutro|negativo", "resumo": "string"}], "wordCloud": [{"palavra": "string", "contagem": number}]}\n\nTop 5 temas e 20 palavras-chave.`;

    let content = '';
    const startMs = Date.now();
    let provider = '';
    let model = '';

    // Try Claude first (Primary)
    if (ANTHROPIC_API_KEY) {
      try {
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
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });
        if (!aiResponse.ok) throw new Error(`Claude ${aiResponse.status}`);
        const aiData = await aiResponse.json();
        content = aiData.content?.[0]?.text ?? '';
        provider = 'CLAUDE';
        model = 'claude-sonnet-4-20250514';
      } catch (e) {
        console.warn('[CS-Trending-Topics] Claude failed:', e);
      }
    }

    // Fallback to Gemini
    if (!content && GOOGLE_API_KEY) {
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GOOGLE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
          }),
        });
        if (!resp.ok) throw new Error(`Gemini ${resp.status}`);
        const data = await resp.json();
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        provider = 'GEMINI';
        model = 'gemini-3-pro-preview';
      } catch (e) {
        console.warn('[CS-Trending-Topics] Gemini fallback failed:', e);
      }
    }

    // Fallback 2: OpenAI GPT-4o via API direta
    if (!content) {
      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      if (OPENAI_API_KEY) {
        try {
          const gptResp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.3, max_tokens: 1500 }),
          });
          if (gptResp.ok) {
            const gptData = await gptResp.json();
            content = gptData.choices?.[0]?.message?.content ?? '';
            provider = 'OPENAI';
            model = 'gpt-4o';
          }
        } catch (gptErr) {
          console.error('[CS-Trending-Topics] OpenAI exception:', gptErr);
        }
      }
    }

    let result = { topics: [], wordCloud: [] };
    if (content) {
      const latencyMs = Date.now() - startMs;
      // Log AI usage
      await supabase.from('ai_usage_log').insert({
        function_name: 'cs-trending-topics',
        provider: provider,
        model: model,
        tokens_input: null,
        tokens_output: null,
        success: true,
        latency_ms: latencyMs,
        custo_estimado: 0,
        empresa: surveys[0]?.empresa || null,
      });

      try {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        result = JSON.parse(cleaned);
      } catch {
        console.error('[CS-Trending-Topics] Failed to parse AI response');
      }
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
