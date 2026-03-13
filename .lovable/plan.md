

## Problema: Áudio outbound não chega no destinatário

### Diagnóstico

Os áudios gravados no navegador (Chrome) são salvos como `audio/webm` porque Chrome **não suporta** gravação em `audio/ogg; codecs=opus`. O MediaAttachments tenta `ogg` primeiro, mas cai no fallback `webm`.

O Meta Cloud API **aceita** o request (retorna `wamid`) mas o WhatsApp **não entrega** arquivos `audio/webm` ao destinatário. Formatos suportados pelo WhatsApp: `audio/ogg` (opus), `audio/aac`, `audio/mp4`, `audio/mpeg`, `audio/amr`.

Confirmação nos dados:
- Mensagem `9728f7c9` → `estado: ENVIADO`, `whatsapp_message_id` presente, mas `media_url` termina em `.webm`
- Mensagens de texto para o mesmo número chegam com `estado: LIDO`

### Correção

Converter o áudio `webm` para `ogg` (opus) **no edge function `whatsapp-send`** antes de enviar para a Meta API, usando FFmpeg via Deno. Alternativa mais simples: usar a própria Meta Media Upload API que aceita o blob e faz conversão interna.

**Abordagem escolhida**: Converter no lado do cliente antes do upload. O `MediaRecorder` do Chrome grava `webm` com codec opus — o container é webm mas o codec já é opus. Basta re-empacotar como `.ogg` usando a lib `muxer` ou, mais simples, renomear o MIME type para `audio/ogg` no upload ao Supabase Storage (o codec interno já é opus, e o WhatsApp aceita).

Na prática, a forma mais confiável é:

**Arquivo: `src/components/conversas/MediaAttachments.tsx`**
- Na função `onstop` do MediaRecorder, quando o mimeType é `audio/webm; codecs=opus`, re-criar o Blob com type `audio/ogg; codecs=opus` e salvar com extensão `.ogg`
- Isso funciona porque o codec interno (opus) é o mesmo — o WhatsApp decodifica pelo codec, não pelo container

**Arquivo: `supabase/functions/whatsapp-send/index.ts`**
- Adicionar fallback: se `media_url` termina em `.webm`, fazer upload via Meta Media API com MIME type `audio/ogg` antes de enviar
- Alternativamente, usar o endpoint de upload de mídia da Meta (`/{phone_number_id}/media`) que aceita o arquivo e retorna um `media_id`, depois enviar a mensagem referenciando o `media_id` em vez de link direto

### Solução recomendada (mais robusta)

1. **`MediaAttachments.tsx`**: Quando gravação é `webm+opus`, salvar como `.ogg` com contentType `audio/ogg; codecs=opus`
2. **`whatsapp-send/index.ts`**: Para áudios, usar Meta Media Upload API (upload o arquivo → receber `media_id` → enviar mensagem com `media_id`) em vez de link direto, garantindo que a Meta processe o formato corretamente

| Arquivo | Ação |
|---|---|
| `src/components/conversas/MediaAttachments.tsx` | Re-empacotar webm+opus como ogg no upload |
| `supabase/functions/whatsapp-send/index.ts` | Usar Media Upload API da Meta para áudios |
| `supabase/functions/_shared/channel-resolver.ts` | Adicionar helper `uploadMediaToMeta` + `sendAudioByIdViaMetaCloud` |

