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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { limit = 20, modelo = 'gemini-3-pro-preview' } = await req.json();

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    if (!GOOGLE_API_KEY && !ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'No AI API key configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: intents, error: intentsError } = await supabase
      .from('lead_message_intents')
      .select('id, message_id, intent, intent_confidence, acao_recomendada, resposta_automatica_texto, modelo_ia, tokens_usados, tempo_processamento_ms, empresa, lead_id')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (intentsError || !intents || intents.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma interpretação encontrada', details: intentsError }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messageIds = intents.map(i => i.message_id);
    const { data: messages } = await supabase
      .from('lead_messages')
      .select('id, conteudo, lead_id, empresa, direcao')
      .in('id', messageIds);

    const messageMap = new Map((messages || []).map(m => [m.id, m]));

    const intentIds = intents.map(i => i.id);
    const { data: existingBenchmarks } = await supabase
      .from('ai_model_benchmarks')
      .select('original_intent_id')
      .in('original_intent_id', intentIds)
      .eq('modelo_ia', modelo);

    const alreadyDone = new Set((existingBenchmarks || []).map(b => b.original_intent_id));
    const toProcess = intents.filter(i => !alreadyDone.has(i.id));

    if (toProcess.length === 0) {
      return new Response(JSON.stringify({
        message: 'Todas as mensagens já foram benchmarkadas com este modelo',
        total: intents.length, processed: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[Benchmark] Processando ${toProcess.length} mensagens com ${modelo}`);

    const benchmarkSystemPrompt = `Você é Amélia, consultora do Grupo Blue (Tokeniza e Blue).
Analise a mensagem do lead e retorne um JSON com:
- intent: tipo de intenção (INTERESSE_COMPRA, INTERESSE_IR, DUVIDA_PRODUTO, DUVIDA_PRECO, DUVIDA_TECNICA, SOLICITACAO_CONTATO, AGENDAMENTO_REUNIAO, RECLAMACAO, OPT_OUT, OBJECAO_PRECO, OBJECAO_RISCO, SEM_INTERESSE, NAO_ENTENDI, CUMPRIMENTO, AGRADECIMENTO, FORA_CONTEXTO, OUTRO)
- confidence: 0.0-1.0
- summary: resumo breve
- acao: ação recomendada (ENVIAR_RESPOSTA_AUTOMATICA, ESCALAR_HUMANO, AJUSTAR_TEMPERATURA, PAUSAR_CADENCIA, CANCELAR_CADENCIA, CRIAR_TAREFA_CLOSER, MARCAR_OPT_OUT, NENHUMA)
- deve_responder: true/false
- resposta_sugerida: texto da resposta ou null

Retorne APENAS o JSON, sem markdown.`;

    const results: any[] = [];

    for (const intent of toProcess) {
      const msg = messageMap.get(intent.message_id);
      if (!msg) continue;

      const userPrompt = `EMPRESA: ${msg.empresa}\nMENSAGEM DO LEAD: ${msg.conteudo}`;
      const startTime = Date.now();

      try {
        let content = '';
        let tokens = 0;

        // Try Gemini first
        if (GOOGLE_API_KEY) {
          try {
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GOOGLE_API_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `${benchmarkSystemPrompt}\n\n${userPrompt}` }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
              }),
            });
            if (!resp.ok) throw new Error(`Gemini ${resp.status}`);
            const data = await resp.json();
            content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            tokens = data.usageMetadata?.totalTokenCount || 0;
          } catch (e) {
            console.warn('[Benchmark] Gemini failed:', e);
          }
        }

        // Fallback to Claude
        if (!content && ANTHROPIC_API_KEY) {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
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
              system: benchmarkSystemPrompt,
              messages: [{ role: 'user', content: userPrompt }],
            }),
          });
          if (!response.ok) throw new Error(`Claude ${response.status}`);
          const data = await response.json();
          content = data.content?.[0]?.text || '';
          tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
        }

        const tempoMs = Date.now() - startTime;

        if (content) {
          const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(cleaned);

          await supabase.from('ai_model_benchmarks').insert({
            original_intent_id: intent.id,
            message_id: intent.message_id,
            modelo_ia: modelo,
            intent: parsed.intent || 'OUTRO',
            intent_confidence: Math.min(1, Math.max(0, parsed.confidence || 0)),
            acao_recomendada: parsed.acao || 'NENHUMA',
            resposta_automatica_texto: parsed.resposta_sugerida || null,
            tokens_usados: tokens,
            tempo_processamento_ms: tempoMs,
          });

          results.push({
            message_id: intent.message_id,
            mensagem: msg.conteudo.substring(0, 100),
            original: { intent: intent.intent, confidence: intent.intent_confidence, acao: intent.acao_recomendada, modelo: intent.modelo_ia, tokens: intent.tokens_usados, tempo_ms: intent.tempo_processamento_ms },
            benchmark: { intent: parsed.intent, confidence: parsed.confidence, acao: parsed.acao, modelo, tokens, tempo_ms: tempoMs, resposta: parsed.resposta_sugerida?.substring(0, 100) || null },
            concordam_intent: intent.intent === parsed.intent,
            concordam_acao: intent.acao_recomendada === parsed.acao,
          });
        }
      } catch (err) {
        console.error(`[Benchmark] Erro processando mensagem ${intent.message_id}:`, err);
        results.push({ message_id: intent.message_id, error: String(err) });
      }

      await new Promise(r => setTimeout(r, 500));
    }

    const successResults = results.filter(r => !r.error);
    const intentMatch = successResults.filter(r => r.concordam_intent).length;
    const acaoMatch = successResults.filter(r => r.concordam_acao).length;
    const avg = (arr: any[], key: string) => arr.reduce((s, r) => s + (r?.[key] || 0), 0) / (arr.length || 1);

    const summary = {
      total_processadas: successResults.length,
      erros: results.filter(r => r.error).length,
      taxa_concordancia_intent: successResults.length > 0 ? (intentMatch / successResults.length * 100).toFixed(1) + '%' : 'N/A',
      taxa_concordancia_acao: successResults.length > 0 ? (acaoMatch / successResults.length * 100).toFixed(1) + '%' : 'N/A',
      confianca_media_original: avg(successResults.map(r => r.original), 'confidence').toFixed(2),
      confianca_media_benchmark: avg(successResults.map(r => r.benchmark), 'confidence').toFixed(2),
      tokens_medio_original: Math.round(avg(successResults.map(r => r.original), 'tokens')),
      tokens_medio_benchmark: Math.round(avg(successResults.map(r => r.benchmark), 'tokens')),
      tempo_medio_original_ms: Math.round(avg(successResults.map(r => r.original), 'tempo_ms')),
      tempo_medio_benchmark_ms: Math.round(avg(successResults.map(r => r.benchmark), 'tempo_ms')),
      modelo_benchmark: modelo,
    };

    return new Response(JSON.stringify({ summary, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Benchmark] Erro geral:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
