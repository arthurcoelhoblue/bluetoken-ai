

# Corrigir transcrição de áudio do WhatsApp

## Problema
O áudio do WhatsApp chega em OGG/Opus. A API `input_audio` do GPT aceita apenas `wav` e `mp3`. O código envia `format: "ogg"` (linha 421), causando erro 400.

## Solução
Converter o áudio OGG para MP3 antes de enviar à API. Como não temos ffmpeg no edge runtime, a abordagem mais robusta é usar a **API de Speech-to-Text do OpenAI (Whisper)** que aceita OGG nativamente, em vez do endpoint multimodal `input_audio`.

Porém, o Lovable AI Gateway não expõe o endpoint Whisper (`/v1/audio/transcriptions`). Alternativas:

1. **Usar Gemini Flash via Lovable AI Gateway** — Gemini aceita áudio inline em qualquer formato (OGG, MP3, WAV). Trocar o modelo para `google/gemini-2.5-flash` e usar o formato de conteúdo adequado para áudio.

2. **Usar OpenAI Whisper diretamente** — via `OPENAI_API_KEY` que já existe nos secrets, chamar `https://api.openai.com/v1/audio/transcriptions` com o arquivo OGG como form-data.

### Recomendação: Opção 1 (Gemini Flash via Gateway)
- Sem custo adicional de API key
- Gemini aceita OGG nativamente via inline_data
- Mais rápido e mais barato que GPT-5-mini

## Mudança

**Arquivo**: `supabase/functions/meta-webhook/index.ts`, linhas 407-432

Trocar a chamada multimodal GPT por Gemini Flash:

```typescript
const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: { data: base64Audio, format: "mp3" },
          },
          {
            type: "text",
            text: "Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem formatação, sem aspas, sem prefixos.",
          },
        ],
      },
    ],
    max_tokens: 2048,
  }),
});
```

O Gemini via gateway aceita áudio em formato inline. Se `mp3` também falhar via gateway, usaremos o fallback direto com OpenAI Whisper API (`OPENAI_API_KEY`) que aceita OGG como multipart form-data.

Também verificar e aplicar a mesma correção no `call-transcribe/index.ts` (linha 141) que usa `format: 'mp3'` — esse já está correto.

## Também corrigir
O mesmo padrão existe em `call-transcribe/index.ts` mas já usa `format: 'mp3'` — sem mudança necessária lá.

