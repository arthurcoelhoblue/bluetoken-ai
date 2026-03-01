

# Usar OpenAI Whisper API para transcrição de áudio

## Problema
O Lovable AI Gateway (endpoint multimodal) não aceita áudio OGG nativamente. O WhatsApp envia áudio em OGG/Opus. Enviar como `format: "mp3"` é mentir sobre o formato e provavelmente falha.

## Solução
Usar a **API Whisper do OpenAI** diretamente via `OPENAI_API_KEY` (já configurada nos secrets). O Whisper aceita OGG nativamente como multipart form-data e é o modelo de referência para speech-to-text.

## Mudança

**Arquivo**: `supabase/functions/meta-webhook/index.ts`, função `transcribeAudio` (linhas ~398-441)

Substituir a chamada multimodal ao Lovable Gateway por uma chamada direta ao endpoint Whisper:

```typescript
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
if (!OPENAI_API_KEY) {
  log.error("OPENAI_API_KEY not configured");
  return null;
}

const audioResp = await fetch(audioUrl);
if (!audioResp.ok) return null;
const audioBlob = await audioResp.blob();

const formData = new FormData();
formData.append("file", new File([audioBlob], "audio.ogg", { type: "audio/ogg" }));
formData.append("model", "whisper-1");
formData.append("language", "pt");
formData.append("response_format", "text");

const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
  method: "POST",
  headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
  body: formData,
});
```

- Remove a conversão para base64 (desnecessária — Whisper usa multipart)
- Remove a dependência do `LOVABLE_API_KEY` para transcrição
- Whisper aceita OGG, MP3, WAV, M4A nativamente
- Mantém o log de erro e retorno `null` em caso de falha

