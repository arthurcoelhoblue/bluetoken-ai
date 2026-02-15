import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// SDR Intent Classifier — calls AI to classify intent, framework data, temperature
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const context = await req.json();
    const { mensagem_normalizada, empresa, historico, classificacao, conversation_state, contato } = context;

    const historicoText = (historico || []).slice(0, 10).map((m: any) => `[${m.direcao}] ${m.conteudo}`).join('\n');
    const contactInfo = contato ? `Nome: ${contato.nome || contato.primeiro_nome || 'Desconhecido'}` : '';
    const classInfo = classificacao ? `ICP: ${classificacao.icp}, Temp: ${classificacao.temperatura}, Score: ${classificacao.score_interno || 'N/A'}` : '';
    const stateInfo = conversation_state ? `Funil: ${conversation_state.estado_funil}, Framework: ${conversation_state.framework_ativo}, DISC: ${conversation_state.perfil_disc || 'N/A'}` : '';

    const prompt = `Analise a mensagem do lead e classifique:

CONTEXTO:
${contactInfo}
${classInfo}
${stateInfo}
Empresa: ${empresa}

HISTÓRICO:
${historicoText}

MENSAGEM ATUAL:
${mensagem_normalizada}

Responda em JSON com:
{
  "intent": "INTERESSE_COMPRA|INTERESSE_IR|DUVIDA_PRODUTO|DUVIDA_PRECO|DUVIDA_TECNICA|SOLICITACAO_CONTATO|AGENDAMENTO_REUNIAO|RECLAMACAO|OPT_OUT|OBJECAO_PRECO|OBJECAO_RISCO|SEM_INTERESSE|NAO_ENTENDI|CUMPRIMENTO|AGRADECIMENTO|FORA_CONTEXTO|OUTRO",
  "confidence": 0.0-1.0,
  "temperatura": "FRIO|MORNO|QUENTE",
  "sentimento": "POSITIVO|NEUTRO|NEGATIVO",
  "resumo": "resumo curto do intent",
  "framework_updates": { "spin": {}, "gpct": {}, "bant": {} },
  "acao_recomendada": "PAUSAR_CADENCIA|CRIAR_TAREFA_CLOSER|ESCALAR_HUMANO|ENVIAR_RESPOSTA_AUTOMATICA|NENHUMA"
}`;

    let result: any = null;
    let model = '';
    let provider = '';

    // Claude primary
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (ANTHROPIC_API_KEY) {
      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 500, temperature: 0.2, messages: [{ role: 'user', content: prompt }] }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const text = data.content?.[0]?.text || '';
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) result = JSON.parse(jsonMatch[0]);
          model = 'claude-sonnet-4-20250514';
          provider = 'claude';
        }
      } catch (e) { console.warn('[sdr-intent-classifier] Claude failed:', e); }
    }

    // Gemini fallback
    if (!result) {
      const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
      if (GOOGLE_API_KEY) {
        try {
          const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 500 } }),
          });
          if (resp.ok) {
            const data = await resp.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) result = JSON.parse(jsonMatch[0]);
            model = 'gemini-3-pro-preview';
            provider = 'gemini';
          }
        } catch (e) { console.warn('[sdr-intent-classifier] Gemini failed:', e); }
      }
    }

    // Deterministic fallback
    if (!result) {
      result = { intent: 'OUTRO', confidence: 0.3, temperatura: classificacao?.temperatura || 'MORNO', sentimento: 'NEUTRO', resumo: 'Classificação determinística', framework_updates: {}, acao_recomendada: 'NENHUMA' };
      model = 'deterministic';
      provider = 'rules';
    }

    // Log
    try {
      await supabase.from('ai_usage_log').insert({ function_name: 'sdr-intent-classifier', provider, model, latency_ms: Date.now() - startTime, success: true, empresa });
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ ...result, model, provider }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[sdr-intent-classifier] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
