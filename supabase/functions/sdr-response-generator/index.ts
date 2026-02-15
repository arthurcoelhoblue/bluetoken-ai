import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// SDR Response Generator — generates personalized AI response based on intent + context
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json();
    const { intent, confidence, temperatura, sentimento, acao_recomendada, framework_updates, mensagem_normalizada, empresa, canal, contato, classificacao, conversation_state, historico } = body;

    // Load product knowledge for response personalization
    const { data: products } = await supabase.from('product_knowledge').select('nome, descricao_curta, preco_texto, diferenciais').eq('empresa', empresa).eq('ativo', true).limit(5);

    // Load active prompt version with A/B testing
    let systemPrompt = '';
    let promptVersionId: string | null = null;
    try {
      const { data: pvList } = await supabase.from('prompt_versions').select('id, content, ab_weight').eq('function_name', 'sdr-response-generator').eq('prompt_key', 'system').eq('is_active', true).gt('ab_weight', 0);
      if (pvList && pvList.length > 0) {
        const totalWeight = pvList.reduce((sum: number, p: any) => sum + (p.ab_weight || 100), 0);
        let rand = Math.random() * totalWeight;
        let selected = pvList[0];
        for (const pv of pvList) { rand -= (pv.ab_weight || 100); if (rand <= 0) { selected = pv; break; } }
        systemPrompt = selected.content;
        promptVersionId = selected.id;
      }
    } catch { /* use default */ }

    if (!systemPrompt) {
      systemPrompt = `Você é a Amélia, SDR IA do ${empresa === 'TOKENIZA' ? 'Tokeniza (investimentos tokenizados)' : 'Blue (IR/tributação cripto)'}.
Tom: profissional, acolhedor, direto. Nunca robótica.
${canal === 'WHATSAPP' ? 'WhatsApp: mensagens CURTAS (2-4 linhas), UMA pergunta por vez.' : 'Email: estruturado, 3-4 parágrafos, retomar contexto.'}
Adapte ao perfil DISC: ${conversation_state?.perfil_disc || 'não identificado'}.
${conversation_state?.perfil_investidor ? `Perfil investidor: ${conversation_state.perfil_investidor}` : ''}`;
    }

    const contactName = contato?.nome || contato?.primeiro_nome || 'Lead';
    const historicoText = (historico || []).slice(0, 8).map((m: any) => `[${m.direcao}] ${m.conteudo}`).join('\n');
    const productsText = products?.map((p: any) => `${p.nome}: ${p.descricao_curta} (${p.preco_texto || 'consultar'})`).join('\n') || '';

    const prompt = `${systemPrompt}

CONTEXTO:
Contato: ${contactName}
Intent: ${intent} (confiança: ${confidence})
Temperatura: ${temperatura}
Sentimento: ${sentimento}
Ação recomendada: ${acao_recomendada}
Estado funil: ${conversation_state?.estado_funil || 'SAUDACAO'}
Canal: ${canal}

PRODUTOS:
${productsText}

HISTÓRICO RECENTE:
${historicoText}

MENSAGEM DO LEAD:
${mensagem_normalizada}

Gere uma resposta personalizada e natural. Se intent for OPT_OUT, respeite. Se for ESCALAR_HUMANO, avise que vai transferir.
Responda APENAS com o texto da mensagem, sem prefixos.`;

    let resposta = '';
    let model = '';
    let provider = '';
    let tokensInput = 0;
    let tokensOutput = 0;

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (ANTHROPIC_API_KEY) {
      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 500, temperature: 0.5, system: systemPrompt, messages: [{ role: 'user', content: prompt }] }),
        });
        if (resp.ok) {
          const data = await resp.json();
          resposta = data.content?.[0]?.text || '';
          model = 'claude-sonnet-4-20250514';
          provider = 'claude';
          tokensInput = data.usage?.input_tokens || 0;
          tokensOutput = data.usage?.output_tokens || 0;
        }
      } catch (e) { console.warn('[sdr-response-generator] Claude failed:', e); }
    }

    if (!resposta) {
      const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
      if (GOOGLE_API_KEY) {
        try {
          const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 500 } }),
          });
          if (resp.ok) {
            const data = await resp.json();
            resposta = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            model = 'gemini-3-pro-preview';
            provider = 'gemini';
          }
        } catch (e) { console.warn('[sdr-response-generator] Gemini failed:', e); }
      }
    }

    if (!resposta) {
      resposta = `Olá ${contactName}! Recebi sua mensagem. Vou encaminhar para um especialista que pode te ajudar melhor. Obrigada! 😊`;
      model = 'fallback';
      provider = 'rules';
    }

    try {
      await supabase.from('ai_usage_log').insert({
        function_name: 'sdr-response-generator', provider, model,
        tokens_input: tokensInput, tokens_output: tokensOutput,
        latency_ms: Date.now() - startTime, success: true, empresa,
        prompt_version_id: promptVersionId,
      });
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ resposta, model, provider, prompt_version_id: promptVersionId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[sdr-response-generator] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
