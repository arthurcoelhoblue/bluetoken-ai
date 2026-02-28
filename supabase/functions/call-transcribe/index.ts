import { callAI } from "../_shared/ai-provider.ts";
import { createServiceClient, envConfig } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('call-transcribe');

interface TranscriptionSegment {
  speaker: 'VENDEDOR' | 'CLIENTE';
  text: string;
  start: number;
  end: number;
}

interface TalkRatio {
  seller_pct: number;
  client_pct: number;
  seller_words: number;
  client_words: number;
}

interface ZadarmaTranscriptResult {
  plainText: string;
  dialogue: TranscriptionSegment[] | null;
  talkRatio: TalkRatio | null;
}

function parseChannelTranscript(data: Record<string, unknown>): ZadarmaTranscriptResult | null {
  try {
    const phrases = data?.phrases as Array<{ result: string; channel: number; start?: number; end?: number }> | undefined;
    const words = data?.words as Array<{ channel: number; result: Array<{ result: string; s: number; e: number }> }> | undefined;

    // If we have phrases with channel info, build dialogue
    if (phrases && Array.isArray(phrases) && phrases.length > 0 && phrases[0]?.channel !== undefined) {
      const dialogue: TranscriptionSegment[] = phrases.map(p => ({
        speaker: p.channel === 1 ? 'VENDEDOR' as const : 'CLIENTE' as const,
        text: p.result || '',
        start: p.start || 0,
        end: p.end || 0,
      })).filter(d => d.text.trim().length > 0);

      const plainText = dialogue.map(d => `${d.speaker}: ${d.text}`).join('\n');

      // Calculate talk ratio from words if available
      let talkRatio: TalkRatio | null = null;
      if (words && Array.isArray(words) && words.length > 0) {
        let sellerTime = 0, clientTime = 0, sellerWords = 0, clientWords = 0;
        for (const w of words) {
          if (!w.result || !Array.isArray(w.result)) continue;
          for (const word of w.result) {
            const duration = (word.e || 0) - (word.s || 0);
            if (w.channel === 1) {
              sellerTime += duration;
              sellerWords++;
            } else {
              clientTime += duration;
              clientWords++;
            }
          }
        }
        const totalTime = sellerTime + clientTime;
        if (totalTime > 0) {
          talkRatio = {
            seller_pct: Math.round((sellerTime / totalTime) * 100),
            client_pct: Math.round((clientTime / totalTime) * 100),
            seller_words: sellerWords,
            client_words: clientWords,
          };
        }
      }

      // If no words data, estimate from phrases
      if (!talkRatio && dialogue.length > 0) {
        const sellerChars = dialogue.filter(d => d.speaker === 'VENDEDOR').reduce((s, d) => s + d.text.length, 0);
        const clientChars = dialogue.filter(d => d.speaker === 'CLIENTE').reduce((s, d) => s + d.text.length, 0);
        const total = sellerChars + clientChars;
        if (total > 0) {
          const sellerWords = dialogue.filter(d => d.speaker === 'VENDEDOR').reduce((s, d) => s + d.text.split(/\s+/).length, 0);
          const clientWords = dialogue.filter(d => d.speaker === 'CLIENTE').reduce((s, d) => s + d.text.split(/\s+/).length, 0);
          talkRatio = {
            seller_pct: Math.round((sellerChars / total) * 100),
            client_pct: Math.round((clientChars / total) * 100),
            seller_words: sellerWords,
            client_words: clientWords,
          };
        }
      }

      if (plainText.trim().length > 20) {
        return { plainText, dialogue, talkRatio };
      }
    }

    // Fallback: plain text transcript
    const text = (data?.transcript as string) || (data?.result as string) || '';
    if (typeof text === 'string' && text.trim().length > 20) {
      return { plainText: text.trim(), dialogue: null, talkRatio: null };
    }

    return null;
  } catch (e) {
    log.error('Parse channel transcript failed', { error: String(e) });
    return null;
  }
}

async function fetchZadarmaTranscript(supabase: ReturnType<typeof createServiceClient>, pbxCallId: string): Promise<ZadarmaTranscriptResult | null> {
  try {
    // Request with words,phrases for channel separation
    const resp = await fetch(`${envConfig.SUPABASE_URL}/functions/v1/zadarma-proxy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${envConfig.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'get_transcript', payload: { call_id: pbxCallId, return: 'words,phrases' } }),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    return parseChannelTranscript(data);
  } catch (e) {
    log.error('Zadarma transcript fetch failed', { error: String(e) });
    return null;
  }
}

async function transcribeWithGeminiMultimodal(recordingUrl: string, empresa: string | null): Promise<ZadarmaTranscriptResult | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return null;

  try {
    const audioResp = await fetch(recordingUrl);
    if (!audioResp.ok) return null;
    const audioBuffer = await audioResp.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: { data: base64Audio, format: 'mp3' },
              },
              {
                type: 'text',
                text: 'Transcreva este áudio de uma chamada comercial em português. Retorne APENAS o texto transcrito, sem formatação adicional.',
              },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (!resp.ok) {
      log.error('Gemini multimodal failed', { status: resp.status, body: await resp.text() });
      return null;
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    if (!text.trim()) return null;
    return { plainText: text.trim(), dialogue: null, talkRatio: null };
  } catch (e) {
    log.error('Gemini multimodal error', { error: String(e) });
    return null;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { call_id } = await req.json();
    if (!call_id) throw new Error('call_id required');

    const supabase = createServiceClient();

    const { data: call, error: callErr } = await supabase.from('calls').select('id, recording_url, deal_id, contact_id, empresa, user_id, direcao, duracao_segundos, cs_customer_id, pbx_call_id').eq('id', call_id).single();
    if (callErr || !call) throw new Error(`Call not found: ${call_id}`);

    let transcriptResult: ZadarmaTranscriptResult | null = null;
    let transcriptionSource = 'none';

    // 1. Try Zadarma native transcript with channel separation
    if (call.pbx_call_id) {
      transcriptResult = await fetchZadarmaTranscript(supabase, call.pbx_call_id);
      if (transcriptResult) {
        transcriptionSource = 'zadarma';
        log.info('Got Zadarma transcript', {
          call_id,
          length: transcriptResult.plainText.length,
          hasDialogue: !!transcriptResult.dialogue,
          hasTalkRatio: !!transcriptResult.talkRatio,
        });
      }
    }

    // 2. Fallback: Gemini Flash multimodal
    if (!transcriptResult && call.recording_url) {
      transcriptResult = await transcribeWithGeminiMultimodal(call.recording_url, call.empresa);
      if (transcriptResult) {
        transcriptionSource = 'gemini';
        log.info('Got Gemini transcript', { call_id, length: transcriptResult.plainText.length });
      }
    }

    if (!transcriptResult) {
      throw new Error('No transcription available: Zadarma transcript not found and Gemini fallback failed');
    }

    // 3. Analyze with shared AI provider
    const aiResult = await callAI({
      system: 'Você é um analista de chamadas comerciais. Retorne APENAS JSON válido sem markdown.',
      prompt: `Analise esta transcrição e retorne JSON: {"summary":"resumo 2-3 frases","sentiment":"POSITIVO|NEGATIVO|NEUTRO","action_items":["..."]}\n\nTranscrição:\n${transcriptResult.plainText}`,
      functionName: 'call-transcribe',
      empresa: call.empresa,
      maxTokens: 1024,
      supabase,
      model: 'claude-haiku',
    });

    let analysis: { summary?: string; sentiment?: string; action_items?: string[] };
    try {
      analysis = JSON.parse((aiResult.content || '{}').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      analysis = { summary: aiResult.content, sentiment: 'NEUTRO', action_items: [] };
    }

    // 4. Update call record with channels and talk ratio
    const updatePayload: Record<string, unknown> = {
      transcription: transcriptResult.plainText,
      summary_ia: analysis.summary || null,
      sentiment: analysis.sentiment || 'NEUTRO',
      action_items: analysis.action_items || [],
    };
    if (transcriptResult.dialogue) {
      updatePayload.transcription_channels = transcriptResult.dialogue;
    }
    if (transcriptResult.talkRatio) {
      updatePayload.talk_ratio = transcriptResult.talkRatio;
    }
    await supabase.from('calls').update(updatePayload).eq('id', call_id);

    // 5. Auto-create deal activity
    if (call.deal_id && analysis.summary) {
      const talkRatioLabel = transcriptResult.talkRatio
        ? ` — 🎙 ${transcriptResult.talkRatio.seller_pct}/${transcriptResult.talkRatio.client_pct}`
        : '';
      await supabase.from('deal_activities').insert({
        deal_id: call.deal_id,
        tipo: 'LIGACAO',
        descricao: `📞 Chamada ${call.direcao === 'INBOUND' ? 'recebida' : 'realizada'} (${Math.round(call.duracao_segundos / 60)}min)${talkRatioLabel} — ${analysis.summary}`,
        user_id: call.user_id,
        metadata: {
          call_id,
          sentiment: analysis.sentiment,
          action_items: analysis.action_items,
          duration_seconds: call.duracao_segundos,
          source: 'call-transcribe-auto',
          transcription_source: transcriptionSource,
          talk_ratio: transcriptResult.talkRatio,
        },
      });
    }

    // 6. CS customer notification
    if (call.cs_customer_id && analysis.summary) {
      const { data: csCustomer } = await supabase.from('cs_customers').select('csm_id, empresa').eq('id', call.cs_customer_id).maybeSingle();
      if (csCustomer?.csm_id) {
        await supabase.from('notifications').insert({ user_id: csCustomer.csm_id, empresa: csCustomer.empresa, titulo: `📞 Chamada transcrita automaticamente`, mensagem: analysis.summary.substring(0, 200), tipo: 'INFO', referencia_tipo: 'CS_CUSTOMER', referencia_id: call.cs_customer_id });
      }
    }

    // 7. CS incident for negative sentiment
    if (analysis.sentiment === 'NEGATIVO' && call.cs_customer_id) {
      await supabase.from('cs_incidents').insert({ customer_id: call.cs_customer_id, empresa: call.empresa, tipo: 'RECLAMACAO', gravidade: 'MEDIA', titulo: `Sentimento negativo detectado em chamada`, descricao: analysis.summary, origem: 'call-transcribe', detectado_por_ia: true });
    }

    return new Response(JSON.stringify({
      success: true,
      call_id,
      transcription_source: transcriptionSource,
      transcription_length: transcriptResult.plainText.length,
      has_dialogue: !!transcriptResult.dialogue,
      talk_ratio: transcriptResult.talkRatio,
      sentiment: analysis.sentiment,
      action_items_count: analysis.action_items?.length || 0,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    log.error('Error', { error: String(err) });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
