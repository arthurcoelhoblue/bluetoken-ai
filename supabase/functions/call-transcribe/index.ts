import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { call_id } = await req.json();
    if (!call_id) throw new Error('call_id required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');
    if (!googleApiKey && !anthropicKey) throw new Error('No AI API key configured for analysis');

    // 1. Fetch call record
    const { data: call, error: callErr } = await supabase
      .from('calls')
      .select('id, recording_url, deal_id, contact_id, empresa, user_id, direcao, duracao_segundos, cs_customer_id')
      .eq('id', call_id)
      .single();

    if (callErr || !call) throw new Error(`Call not found: ${call_id}`);
    if (!call.recording_url) throw new Error('No recording_url for this call');

    // 2. Download recording audio
    console.log('Downloading recording:', call.recording_url);
    const audioResponse = await fetch(call.recording_url);
    if (!audioResponse.ok) throw new Error(`Failed to download recording: ${audioResponse.status}`);
    const audioBlob = await audioResponse.blob();

    // 3. Send to OpenAI Whisper for transcription
    console.log('Sending to Whisper STT...');
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

    if (!whisperResp.ok) {
      const errText = await whisperResp.text();
      throw new Error(`Whisper error ${whisperResp.status}: ${errText}`);
    }

    const transcription = await whisperResp.text();
    console.log(`Transcription received: ${transcription.length} chars`);

    // 4. Analyze with AI (Gemini primary, Claude fallback)
    console.log('Analyzing transcription...');
    const analysisPrompt = `Analise esta transcrição de chamada comercial e retorne um JSON com exatamente estes campos:
{
  "summary": "resumo de 2-3 frases da chamada",
  "sentiment": "POSITIVO" ou "NEGATIVO" ou "NEUTRO",
  "action_items": ["lista de ações concretas identificadas"]
}

Transcrição:
${transcription}

Retorne APENAS o JSON, sem markdown.`;

    let analysisText = '';
    const analysisStartMs = Date.now();
    let analysisProvider = '';
    let analysisModel = '';

    // Try Claude first (Primary)
    if (anthropicKey) {
      try {
        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [{ role: 'user', content: analysisPrompt }],
          }),
        });
        if (!claudeResp.ok) throw new Error(`Claude ${claudeResp.status}`);
        const claudeData = await claudeResp.json();
        analysisText = claudeData.content?.[0]?.text || '';
        analysisProvider = 'CLAUDE';
        analysisModel = 'claude-sonnet-4-20250514';
        console.log('[call-transcribe] Claude analysis OK');
      } catch (e) {
        console.warn('[call-transcribe] Claude failed:', e);
      }
    }

    // Fallback to Gemini
    if (!analysisText && googleApiKey) {
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${googleApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: analysisPrompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
          }),
        });
        if (!resp.ok) throw new Error(`Gemini ${resp.status}`);
        const data = await resp.json();
        analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        analysisProvider = 'GEMINI';
        analysisModel = 'gemini-3-pro-preview';
        console.log('[call-transcribe] Gemini fallback OK');
      } catch (e) {
        console.warn('[call-transcribe] Gemini fallback failed:', e);
      }
    }

    // Fallback 2: OpenAI
    if (!analysisText) {
      try {
        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [{ role: 'user', content: analysisPrompt }],
          }),
        });
        if (!claudeResp.ok) throw new Error(`Claude ${claudeResp.status}`);
        const claudeData = await claudeResp.json();
        analysisText = claudeData.content?.[0]?.text || '{}';
        console.log('[call-transcribe] Claude fallback OK');
      } catch (e) {
        console.error('[call-transcribe] Claude fallback failed:', e);
      }
    }

    // Fallback 2: OpenAI GPT-4o via API direta (for analysis, not transcription)
    if (!analysisText) {
      const openaiKeyForAnalysis = Deno.env.get('OPENAI_API_KEY');
      if (openaiKeyForAnalysis) {
        console.log('[call-transcribe] Trying OpenAI GPT-4o fallback for analysis...');
        try {
          const gptResp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKeyForAnalysis}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: analysisPrompt }], temperature: 0.3, max_tokens: 1024 }),
          });
          if (gptResp.ok) {
            const gptData = await gptResp.json();
            analysisText = gptData.choices?.[0]?.message?.content ?? '';
            console.log('[call-transcribe] OpenAI GPT-4o fallback OK');
          }
        } catch (gptErr) {
          console.error('[call-transcribe] OpenAI exception:', gptErr);
        }
      }
    }

    let analysis: { summary?: string; sentiment?: string; action_items?: string[] };
    try {
      const cleaned = (analysisText || '{}').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = { summary: analysisText, sentiment: 'NEUTRO', action_items: [] };
    }

    // Log AI usage (transcription + analysis)
    try {
      await supabase.from('ai_usage_log').insert([
        { function_name: 'call-transcribe', provider: 'OPENAI', model: 'whisper-1', tokens_input: null, tokens_output: null, success: true, latency_ms: null, custo_estimado: 0, empresa: call.empresa },
        { function_name: 'call-transcribe', provider: analysisProvider || 'OPENAI', model: analysisModel || 'gpt-4o', tokens_input: null, tokens_output: null, success: !!analysisText, latency_ms: Date.now() - analysisStartMs, custo_estimado: 0, empresa: call.empresa },
      ]);
    } catch (logErr) { console.warn('[call-transcribe] ai_usage_log error:', logErr); }

    // 5. Update call record
    const { error: updateErr } = await supabase.from('calls').update({
      transcription,
      summary_ia: analysis.summary || null,
      sentiment: analysis.sentiment || 'NEUTRO',
      action_items: analysis.action_items || [],
    }).eq('id', call_id);

    if (updateErr) console.error('Error updating call:', updateErr);

    // 6. If deal linked, create deal_activity automatically
    if (call.deal_id && analysis.summary) {
      await supabase.from('deal_activities').insert({
        deal_id: call.deal_id,
        tipo: 'LIGACAO',
        descricao: `📞 Chamada ${call.direcao === 'INBOUND' ? 'recebida' : 'realizada'} (${Math.round(call.duracao_segundos / 60)}min) — ${analysis.summary}`,
        user_id: call.user_id,
        metadata: {
          call_id,
          sentiment: analysis.sentiment,
          action_items: analysis.action_items,
          duration_seconds: call.duracao_segundos,
          source: 'call-transcribe-auto',
        },
      });
      console.log('[call-transcribe] Auto-created deal activity');
    }

    // 6b. If CS customer linked, also create activity
    if (call.cs_customer_id && analysis.summary) {
      // Create a notification for the CSM with the call summary
      const { data: csCustomer } = await supabase
        .from('cs_customers')
        .select('csm_id, empresa')
        .eq('id', call.cs_customer_id)
        .maybeSingle();

      if (csCustomer?.csm_id) {
        await supabase.from('notifications').insert({
          user_id: csCustomer.csm_id,
          empresa: csCustomer.empresa,
          titulo: `📞 Chamada transcrita automaticamente`,
          mensagem: analysis.summary.substring(0, 200),
          tipo: 'INFO',
          referencia_tipo: 'CS_CUSTOMER',
          referencia_id: call.cs_customer_id,
        });
      }
    }

    // 7. If sentiment NEGATIVE and cs_customer linked, create incident
    if (analysis.sentiment === 'NEGATIVO' && call.cs_customer_id) {
      await supabase.from('cs_incidents').insert({
        customer_id: call.cs_customer_id,
        empresa: call.empresa,
        tipo: 'RECLAMACAO',
        gravidade: 'MEDIA',
        titulo: `Sentimento negativo detectado em chamada`,
        descricao: analysis.summary,
        origem: 'call-transcribe',
        detectado_por_ia: true,
      });
      console.log('CS incident created for negative sentiment');
    }

    return new Response(JSON.stringify({
      success: true,
      call_id,
      transcription_length: transcription.length,
      sentiment: analysis.sentiment,
      action_items_count: analysis.action_items?.length || 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('call-transcribe error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
