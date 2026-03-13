

## Plano: Conversão WebM→OGG/Opus no edge function

### Problema
Chrome grava `audio/webm` (Opus). A Meta Cloud API aceita `audio/ogg` (Opus) mas **valida os bytes do container** — enviar WebM com MIME `audio/ogg` falha. Enviar como documento funciona mas não é reproduzível inline no WhatsApp.

### Solução
Criar uma edge function `audio-convert` que usa FFmpeg (WASM) para converter WebM→OGG/Opus antes de enviar para Meta. Como FFmpeg WASM é pesado para edge functions, a alternativa mais confiável é usar um **serviço externo de conversão** ou fazer a conversão **no próprio edge function via chamada HTTP a um microserviço FFmpeg**.

Porém, a abordagem **mais prática e imediata** sem infraestrutura adicional:

### Abordagem: Gravar em MP4 no cliente (Chrome 124+ suporta)

Chrome 124+ (lançado abril 2024) suporta `MediaRecorder` com `audio/mp4`. O WhatsApp aceita `audio/mp4` nativamente. Isso elimina o problema na raiz sem precisar de conversão server-side.

**Cadeia de prioridade no cliente:**
```text
1. audio/ogg; codecs=opus  → Firefox/Chrome futuro (WhatsApp aceita ✓)
2. audio/mp4               → Chrome 124+, Safari (WhatsApp aceita ✓)  
3. audio/webm; codecs=opus → Chrome antigo → conversão server-side ou fallback documento
```

### Mudanças

| Arquivo | Ação |
|---|---|
| `src/components/conversas/MediaAttachments.tsx` | Adicionar `audio/mp4` na cadeia de MIME types entre `ogg` e `webm`. No `onstop`, tratar `.m4a` com `audio/mp4` |
| `supabase/functions/whatsapp-send/index.ts` | WebM: tentar upload via Media API com `audio/ogg` (pode funcionar se Meta aceitar bytes WebM com Opus). Se falhar, enviar como documento. MP4/M4A: enviar como áudio normal |
| `supabase/functions/_shared/channel-resolver.ts` | Corrigir `uploadMediaToMeta` para usar MIME e filename dinâmicos (não hardcoded `audio.ogg`) |

### Detalhes técnicos

**Cliente (MediaAttachments.tsx):**
```typescript
const mimeType = MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
  ? 'audio/ogg; codecs=opus'
  : MediaRecorder.isTypeSupported('audio/mp4')
  ? 'audio/mp4'
  : MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
  ? 'audio/webm; codecs=opus'
  : 'audio/webm';

// onstop:
const isOgg = mimeType.includes('ogg');
const isMp4 = mimeType.includes('mp4');
const ext = isOgg ? 'ogg' : isMp4 ? 'm4a' : 'webm';
const mime = isOgg ? 'audio/ogg; codecs=opus' : isMp4 ? 'audio/mp4' : 'audio/webm';
```

**Edge function (whatsapp-send) — case 'audio':**
```typescript
case 'audio': {
  const audioUrl = mediaUrl!;
  const isWebm = audioUrl.toLowerCase().includes('.webm');
  
  if (isWebm) {
    // Tentar upload via Media API declarando audio/ogg
    const uploadResult = await uploadMediaToMeta(metaConfig, audioUrl, 'audio/ogg');
    if (uploadResult.success && uploadResult.mediaId) {
      metaMediaResult = await sendAudioByIdViaMetaCloud(metaConfig, phoneToSend, uploadResult.mediaId);
    } else {
      // Fallback: documento
      metaMediaResult = await sendDocumentViaMetaCloud(metaConfig, phoneToSend, audioUrl, 'audio.webm');
    }
  } else {
    // OGG ou MP4 — enviar direto como áudio
    metaMediaResult = await sendAudioViaMetaCloud(metaConfig, phoneToSend, audioUrl);
  }
  break;
}
```

**channel-resolver.ts — uploadMediaToMeta:**
- Parâmetro `filename` dinâmico em vez de hardcoded `'audio.ogg'`

