// ========================================
// MEETING TRANSCRIPTION — Upload, extract metadata, discard file
// Receives a transcription file, extracts key insights via LLM, saves metadata, deletes file
//
// POST { meeting_id, transcription_text } (text already extracted client-side)
// OR POST multipart form with file + meeting_id (file processed server-side)
// Returns { success, metadata }
// ========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envConfig } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import { callAI } from "../_shared/ai-provider.ts";

const log = createLogger('meeting-transcription');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranscriptionMetadata {
  resumo: string;
  pontos_chave: string[];
  proximos_passos: string[];
  objecoes_levantadas: string[];
  interesse_detectado: string; // ALTO, MEDIO, BAIXO
  produtos_mencionados: string[];
  sentimento_geral: string; // POSITIVO, NEUTRO, NEGATIVO
  duracao_estimada_minutos: number | null;
  participantes_detectados: string[];
  decisoes_tomadas: string[];
  perguntas_pendentes: string[];
}

// ========================================
// EXTRACT METADATA VIA LLM
// ========================================

async function extractMetadata(transcriptionText: string, empresa: string): Promise<TranscriptionMetadata> {
  const systemPrompt = `Você é um analista de reuniões comerciais. Extraia metadados estruturados de transcrições de reuniões de vendas.
Empresa: ${empresa}
Responda APENAS em JSON válido, sem markdown, sem backticks.`;

  const userPrompt = `Analise esta transcrição de reunião e extraia os metadados:

<transcricao>
${transcriptionText.substring(0, 15000)}
</transcricao>

Retorne um JSON com esta estrutura exata:
{
  "resumo": "Resumo executivo da reunião em 2-3 frases",
  "pontos_chave": ["ponto 1", "ponto 2"],
  "proximos_passos": ["ação 1", "ação 2"],
  "objecoes_levantadas": ["objeção 1"],
  "interesse_detectado": "ALTO|MEDIO|BAIXO",
  "produtos_mencionados": ["produto 1"],
  "sentimento_geral": "POSITIVO|NEUTRO|NEGATIVO",
  "duracao_estimada_minutos": 30,
  "participantes_detectados": ["Nome 1", "Nome 2"],
  "decisoes_tomadas": ["decisão 1"],
  "perguntas_pendentes": ["pergunta 1"]
}`;

  try {
    const response = await callAI({
      model: 'default', // Uses Sonnet
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices?.[0]?.message?.content || '{}';
    // Clean potential markdown wrapping
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as TranscriptionMetadata;
  } catch (error) {
    log.error('LLM extraction failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      resumo: 'Não foi possível extrair resumo automaticamente.',
      pontos_chave: [],
      proximos_passos: [],
      objecoes_levantadas: [],
      interesse_detectado: 'MEDIO',
      produtos_mencionados: [],
      sentimento_geral: 'NEUTRO',
      duracao_estimada_minutos: null,
      participantes_detectados: [],
      decisoes_tomadas: [],
      perguntas_pendentes: [],
    };
  }
}

// ========================================
// MAIN
// ========================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);
    
    let meetingId: string;
    let transcriptionText: string;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // File upload mode
      const formData = await req.formData();
      meetingId = formData.get('meeting_id') as string;
      const file = formData.get('file') as File;
      
      if (!file || !meetingId) throw new Error('meeting_id and file required');

      // Read file content as text
      transcriptionText = await file.text();
      log.info('File uploaded', { fileName: file.name, size: file.size, meetingId });
      
      // File is NOT stored — only text is processed
    } else {
      // JSON mode (text already extracted client-side)
      const body = await req.json();
      meetingId = body.meeting_id;
      transcriptionText = body.transcription_text;
      
      if (!meetingId || !transcriptionText) throw new Error('meeting_id and transcription_text required');
    }

    // 1. Get meeting info
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, empresa, vendedor_id, lead_id, deal_id')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) throw new Error('Meeting not found');

    // 2. Extract metadata via LLM
    log.info('Extracting metadata', { meetingId, textLength: transcriptionText.length });
    const metadata = await extractMetadata(transcriptionText, meeting.empresa as string);

    // 3. Save metadata to meeting record
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        transcricao_metadata: metadata,
        transcricao_processada: true,
        transcricao_processada_em: new Date().toISOString(),
        status: 'REALIZADA',
        updated_at: new Date().toISOString(),
      })
      .eq('id', meetingId);

    if (updateError) {
      log.error('Meeting update error', { error: updateError.message });
      throw updateError;
    }

    // 4. Update deal if exists — add insights to timeline
    if (meeting.deal_id) {
      await supabase.from('deal_activities').insert({
        deal_id: meeting.deal_id,
        tipo: 'NOTA',
        titulo: `Resumo da reunião: ${metadata.resumo.substring(0, 100)}`,
        descricao: [
          `**Resumo:** ${metadata.resumo}`,
          `**Interesse:** ${metadata.interesse_detectado} | **Sentimento:** ${metadata.sentimento_geral}`,
          metadata.pontos_chave.length > 0 ? `**Pontos-chave:** ${metadata.pontos_chave.join('; ')}` : null,
          metadata.proximos_passos.length > 0 ? `**Próximos passos:** ${metadata.proximos_passos.join('; ')}` : null,
          metadata.objecoes_levantadas.length > 0 ? `**Objeções:** ${metadata.objecoes_levantadas.join('; ')}` : null,
          metadata.decisoes_tomadas.length > 0 ? `**Decisões:** ${metadata.decisoes_tomadas.join('; ')}` : null,
          metadata.perguntas_pendentes.length > 0 ? `**Pendências:** ${metadata.perguntas_pendentes.join('; ')}` : null,
        ].filter(Boolean).join('\n'),
        status: 'CONCLUIDA',
        criado_por: meeting.vendedor_id as string,
      });
    }

    // 5. If lead exists, save key facts as lead_facts
    if (meeting.lead_id && metadata.objecoes_levantadas.length > 0) {
      for (const objecao of metadata.objecoes_levantadas) {
        await supabase.from('lead_facts').upsert({
          lead_id: meeting.lead_id,
          empresa: meeting.empresa,
          chave: 'objecao_reuniao',
          valor: objecao,
          fonte: 'transcricao_reuniao',
          confianca: 0.9,
        }, { onConflict: 'lead_id,empresa,chave' }).then(({ error }) => {
          if (error) log.warn('Lead fact upsert warning', { error: error.message });
        });
      }
    }

    // 6. Update conversation state if lead has active conversation
    if (meeting.lead_id && metadata.interesse_detectado === 'ALTO') {
      await supabase.from('lead_classifications')
        .update({ temperatura: 'QUENTE', updated_at: new Date().toISOString() })
        .eq('lead_id', meeting.lead_id)
        .eq('empresa', meeting.empresa as string);
    }

    log.info('Transcription processed successfully', {
      meetingId,
      interesse: metadata.interesse_detectado,
      pontosChave: metadata.pontos_chave.length,
      proximosPassos: metadata.proximos_passos.length,
    });

    // NOTE: The original file is NEVER stored. Only metadata persists.
    return new Response(JSON.stringify({
      success: true,
      meeting_id: meetingId,
      metadata,
      message: 'Transcrição processada. Metadados extraídos e arquivo descartado.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    log.error('Error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
