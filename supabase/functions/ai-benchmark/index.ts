import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-provider.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { limit = 20, modelo = 'gemini-3-pro-preview' } = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: intents, error: intentsError } = await supabase
      .from('lead_message_intents')
      .select('id, message_id, intent, intent_confidence, acao_recomendada, resposta_automatica_texto, modelo_ia, tokens_usados, tempo_processamento_ms, empresa, lead_id')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (intentsError || !intents || intents.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma interpretação encontrada', details: intentsError }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const messageIds = intents.map(i => i.message_id);
    const { data: messages } = await supabase.from('lead_messages').select('id, conteudo, lead_id, empresa, direcao').in('id', messageIds);
    const messageMap = new Map((messages || []).map(m => [m.id, m]));

    const intentIds = intents.map(i => i.id);
    const { data: existingBenchmarks } = await supabase.from('ai_model_benchmarks').select('original_intent_id').in('original_intent_id', intentIds).eq('modelo_ia', modelo);
    const alreadyDone = new Set((existingBenchmarks || []).map(b => b.original_intent_id));
    const toProcess = intents.filter(i => !alreadyDone.has(i.id));

    if (toProcess.length === 0) {
      return new Response(JSON.stringify({ message: 'Todas as mensagens já foram benchmarkadas', total: intents.length, processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const benchmarkSystemPrompt = `Você é Amélia, consultora do Grupo Blue. Analise a mensagem do lead e retorne JSON com: intent, confidence (0-1), summary, acao, deve_responder, resposta_sugerida. Retorne APENAS JSON.`;

    const results: any[] = [];

    for (const intent of toProcess) {
      const msg = messageMap.get(intent.message_id);
      if (!msg) continue;

      const userPrompt = `EMPRESA: ${msg.empresa}\nMENSAGEM DO LEAD: ${msg.conteudo}`;

      try {
        const aiResult = await callAI({
          system: benchmarkSystemPrompt,
          prompt: userPrompt,
          functionName: 'ai-benchmark',
          empresa: msg.empresa,
          temperature: 0.3,
          maxTokens: 1500,
          supabase,
        });

        if (aiResult.content) {
          const cleaned = aiResult.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(cleaned);

          await supabase.from('ai_model_benchmarks').insert({
            original_intent_id: intent.id,
            message_id: intent.message_id,
            modelo_ia: modelo,
            intent: parsed.intent || 'OUTRO',
            intent_confidence: Math.min(1, Math.max(0, parsed.confidence || 0)),
            acao_recomendada: parsed.acao || 'NENHUMA',
            resposta_automatica_texto: parsed.resposta_sugerida || null,
            tokens_usados: aiResult.tokensInput + aiResult.tokensOutput,
            tempo_processamento_ms: aiResult.latencyMs,
          });

          results.push({
            message_id: intent.message_id,
            mensagem: msg.conteudo.substring(0, 100),
            original: { intent: intent.intent, confidence: intent.intent_confidence, acao: intent.acao_recomendada, modelo: intent.modelo_ia },
            benchmark: { intent: parsed.intent, confidence: parsed.confidence, acao: parsed.acao, modelo, tokens: aiResult.tokensInput + aiResult.tokensOutput, tempo_ms: aiResult.latencyMs },
            concordam_intent: intent.intent === parsed.intent,
            concordam_acao: intent.acao_recomendada === parsed.acao,
          });
        }
      } catch (err) {
        console.error(`[Benchmark] Erro processando ${intent.message_id}:`, err);
        results.push({ message_id: intent.message_id, error: String(err) });
      }

      await new Promise(r => setTimeout(r, 500));
    }

    const successResults = results.filter(r => !r.error);
    const intentMatch = successResults.filter(r => r.concordam_intent).length;
    const acaoMatch = successResults.filter(r => r.concordam_acao).length;

    return new Response(JSON.stringify({
      summary: {
        total_processadas: successResults.length,
        erros: results.filter(r => r.error).length,
        taxa_concordancia_intent: successResults.length > 0 ? (intentMatch / successResults.length * 100).toFixed(1) + '%' : 'N/A',
        taxa_concordancia_acao: successResults.length > 0 ? (acaoMatch / successResults.length * 100).toFixed(1) + '%' : 'N/A',
        modelo_benchmark: modelo,
      },
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[Benchmark] Erro geral:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
