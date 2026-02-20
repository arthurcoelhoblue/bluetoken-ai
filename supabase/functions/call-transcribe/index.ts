import { callAI } from "../_shared/ai-provider.ts";
import { createServiceClient, getOptionalEnv } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('call-transcribe');

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { call_id } = await req.json();
    if (!call_id) throw new Error('call_id required');

    const supabase = createServiceClient();
    const openaiKey = getOptionalEnv('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');

    const { data: call, error: callErr } = await supabase.from('calls').select('id, recording_url, deal_id, contact_id, empresa, user_id, direcao, duracao_segundos, cs_customer_id').eq('id', call_id).single();
    if (callErr || !call) throw new Error(`Call not found: ${call_id}`);
    if (!call.recording_url) throw new Error('No recording_url for this call');

    // 1. Download + Whisper transcription (stays as direct OpenAI call - not a chat completion)
    const audioResponse = await fetch(call.recording_url);
    if (!audioResponse.ok) throw new Error(`Failed to download recording: ${audioResponse.status}`);
    const audioBlob = await audioResponse.blob();

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.mp3');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'text');

    const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: formData,
    });
    if (!whisperResp.ok) throw new Error(`Whisper error ${whisperResp.status}: ${await whisperResp.text()}`);
    const transcription = await whisperResp.text();

    // Log Whisper usage separately
    try {
      await supabase.from('ai_usage_log').insert({ function_name: 'call-transcribe', provider: 'OPENAI', model: 'whisper-1', tokens_input: 0, tokens_output: 0, success: true, latency_ms: 0, custo_estimado: 0, empresa: call.empresa });
    } catch { /* ignore */ }

    // 2. Analyze with shared AI provider
    const aiResult = await callAI({
      system: 'Você é um analista de chamadas comerciais. Retorne APENAS JSON válido sem markdown.',
      prompt: `Analise esta transcrição e retorne JSON: {"summary":"resumo 2-3 frases","sentiment":"POSITIVO|NEGATIVO|NEUTRO","action_items":["..."]}\n\nTranscrição:\n${transcription}`,
      functionName: 'call-transcribe',
      empresa: call.empresa,
      maxTokens: 1024,
      supabase,
      model: 'gemini-flash',
    });

    let analysis: { summary?: string; sentiment?: string; action_items?: string[] };
    try {
      analysis = JSON.parse((aiResult.content || '{}').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      analysis = { summary: aiResult.content, sentiment: 'NEUTRO', action_items: [] };
    }

    // 3. Update call record
    await supabase.from('calls').update({ transcription, summary_ia: analysis.summary || null, sentiment: analysis.sentiment || 'NEUTRO', action_items: analysis.action_items || [] }).eq('id', call_id);

    // 4. Auto-create deal activity
    if (call.deal_id && analysis.summary) {
      await supabase.from('deal_activities').insert({ deal_id: call.deal_id, tipo: 'LIGACAO', descricao: `📞 Chamada ${call.direcao === 'INBOUND' ? 'recebida' : 'realizada'} (${Math.round(call.duracao_segundos / 60)}min) — ${analysis.summary}`, user_id: call.user_id, metadata: { call_id, sentiment: analysis.sentiment, action_items: analysis.action_items, duration_seconds: call.duracao_segundos, source: 'call-transcribe-auto' } });
    }

    // 5. CS customer notification
    if (call.cs_customer_id && analysis.summary) {
      const { data: csCustomer } = await supabase.from('cs_customers').select('csm_id, empresa').eq('id', call.cs_customer_id).maybeSingle();
      if (csCustomer?.csm_id) {
        await supabase.from('notifications').insert({ user_id: csCustomer.csm_id, empresa: csCustomer.empresa, titulo: `📞 Chamada transcrita automaticamente`, mensagem: analysis.summary.substring(0, 200), tipo: 'INFO', referencia_tipo: 'CS_CUSTOMER', referencia_id: call.cs_customer_id });
      }
    }

    // 6. CS incident for negative sentiment
    if (analysis.sentiment === 'NEGATIVO' && call.cs_customer_id) {
      await supabase.from('cs_incidents').insert({ customer_id: call.cs_customer_id, empresa: call.empresa, tipo: 'RECLAMACAO', gravidade: 'MEDIA', titulo: `Sentimento negativo detectado em chamada`, descricao: analysis.summary, origem: 'call-transcribe', detectado_por_ia: true });
    }

    return new Response(JSON.stringify({ success: true, call_id, transcription_length: transcription.length, sentiment: analysis.sentiment, action_items_count: analysis.action_items?.length || 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    log.error('Error', { error: String(err) });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
