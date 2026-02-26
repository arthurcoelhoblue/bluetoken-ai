

## Fase 4: Suporte a Mídia — Meta Cloud API ✅

### Contexto
Sistema expandido para processar mensagens de mídia (imagem, documento, áudio, vídeo, sticker, location) além de texto.

### Implementação Concluída

**1. Migração SQL** ✅
- Colunas adicionadas: `tipo_midia`, `media_url`, `media_mime_type`, `media_filename`, `media_caption`, `media_meta_id`
- Bucket `whatsapp-media` criado com RLS

**2. meta-webhook/index.ts** ✅
- `extractMediaInfo()` processa todos os tipos de mídia da Meta
- `downloadMetaMedia()` baixa mídia via Graph API → Storage bucket → URL pública
- SDR-IA interpret só é chamado para mensagens de texto

**3. channel-resolver.ts** ✅
- `sendImageViaMetaCloud()`, `sendDocumentViaMetaCloud()`, `sendAudioViaMetaCloud()`, `sendVideoViaMetaCloud()`
- Helper genérico `sendMediaViaMetaCloud()`

**4. whatsapp-send/index.ts** ✅
- Aceita `mediaType`, `mediaUrl`, `mediaCaption`, `mediaFilename`
- Roteia para helper correto baseado no tipo
- Validação de janela 24h para envio de mídia

**5. Frontend** ✅
- Componente `MediaContent` renderiza: imagem (lightbox), vídeo (player), áudio (player), documento (download), sticker, location, contacts
- `ConversationView` integrado com `MediaContent`
- Tipos atualizados com `TipoMidia`

### Arquivos impactados
| Arquivo | Ação |
|---------|------|
| Migração SQL | Colunas mídia + bucket ✅ |
| `supabase/functions/meta-webhook/index.ts` | Mídia inbound + download ✅ |
| `supabase/functions/_shared/channel-resolver.ts` | Helpers de envio ✅ |
| `supabase/functions/whatsapp-send/index.ts` | Roteamento de mídia ✅ |
| `src/types/messaging.ts` | `TipoMidia` + campos media ✅ |
| `src/components/messages/MediaContent.tsx` | Novo componente ✅ |
| `src/components/messages/ConversationView.tsx` | Integrado ✅ |
| `src/hooks/useLeadMessages.ts` | Campos media ✅ |
| `src/hooks/useConversationMessages.ts` | Campos media ✅ |
