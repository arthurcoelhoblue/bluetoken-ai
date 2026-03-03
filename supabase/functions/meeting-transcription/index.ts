import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/config.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai-provider.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const { meeting_id, transcription_text } = await req.json();
    if (!meeting_id || !transcription_text) {
      return json({ error: "meeting_id e transcription_text obrigatórios" }, 400);
    }

    const supabase = createServiceClient();

    // Verify meeting exists
    const { data: meeting, error: meetErr } = await supabase
      .from("meetings")
      .select("id, empresa, deal_id, titulo")
      .eq("id", meeting_id)
      .single();

    if (meetErr || !meeting) return json({ error: "Reunião não encontrada" }, 404);

    // Use callAI with correct signature to extract metadata
    const result = await callAI({
      system: `Você é um assistente que analisa transcrições de reuniões de vendas.
Extraia as seguintes informações em JSON:
- resumo: resumo de 2-3 frases da reunião
- pontos_chave: array de strings com os pontos principais discutidos
- proximos_passos: array de strings com os próximos passos acordados
- sentimento: POSITIVO, NEUTRO ou NEGATIVO
- decisoes: array de strings com decisões tomadas
- objecoes: array de strings com objeções levantadas pelo prospect`,
      prompt: `Transcrição da reunião "${meeting.titulo}":\n\n${transcription_text}`,
      functionName: "meeting-transcription",
      empresa: meeting.empresa,
      temperature: 0.2,
      maxTokens: 2000,
      supabase,
      model: "claude-haiku",
    });

    let metadata = {};
    try {
      // Try to parse JSON from response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        metadata = JSON.parse(jsonMatch[0]);
      }
    } catch {
      metadata = { resumo: result.content, raw: true };
    }

    // Update meeting with transcription data (columns exist inline in meetings table)
    const { error: updateErr } = await supabase.from("meetings").update({
      transcricao_metadata: metadata,
      transcricao_processada: true,
      transcricao_processada_em: new Date().toISOString(),
    }).eq("id", meeting_id);

    if (updateErr) return json({ error: "Failed to update meeting", details: updateErr.message }, 500);

    // If deal_id, create activity
    if (meeting.deal_id) {
      await supabase.from("deal_activities").insert({
        deal_id: meeting.deal_id,
        tipo: "NOTA",
        descricao: `📝 Transcrição da reunião "${meeting.titulo}" processada`,
        metadata: { meeting_id, resumo: (metadata as Record<string, unknown>).resumo || null },
      });
    }

    return json({ success: true, metadata });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
