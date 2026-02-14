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
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');

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

    // 4. Use Claude to generate summary, sentiment, action_items
    console.log('Analyzing with Claude...');
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
        messages: [{
          role: 'user',
          content: `Analise esta transcrição de chamada comercial e retorne um JSON com exatamente estes campos:
{
  "summary": "resumo de 2-3 frases da chamada",
  "sentiment": "POSITIVO" ou "NEGATIVO" ou "NEUTRO",
  "action_items": ["lista de ações concretas identificadas"]
}

Transcrição:
${transcription}

Retorne APENAS o JSON, sem markdown.`,
        }],
      }),
    });

    if (!claudeResp.ok) {
      const errText = await claudeResp.text();
      throw new Error(`Claude error ${claudeResp.status}: ${errText}`);
    }

    const claudeData = await claudeResp.json();
    const analysisText = claudeData.content?.[0]?.text || '{}';
    let analysis: { summary?: string; sentiment?: string; action_items?: string[] };
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      analysis = { summary: analysisText, sentiment: 'NEUTRO', action_items: [] };
    }

    // 5. Update call record with transcription + analysis
    const { error: updateErr } = await supabase.from('calls').update({
      transcription,
      summary_ia: analysis.summary || null,
      sentiment: analysis.sentiment || 'NEUTRO',
      action_items: analysis.action_items || [],
    }).eq('id', call_id);

    if (updateErr) console.error('Error updating call:', updateErr);

    // 6. If deal linked, create deal_activity with summary
    if (call.deal_id && analysis.summary) {
      await supabase.from('deal_activities').insert({
        deal_id: call.deal_id,
        tipo: 'NOTA',
        descricao: `📞 Resumo IA da chamada: ${analysis.summary}`,
        user_id: call.user_id,
        metadata: {
          call_id,
          sentiment: analysis.sentiment,
          action_items: analysis.action_items,
          source: 'call-transcribe',
        },
      });
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
