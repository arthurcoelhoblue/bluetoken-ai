

## Fase 4: Suporte a Mídia — Meta Cloud API

### Contexto
Atualmente o sistema só processa mensagens de texto (inbound e outbound). A Meta Cloud API suporta imagens, documentos, áudio, vídeo e stickers. Precisamos:
1. Expandir o schema `lead_messages` para armazenar metadados de mídia
2. Atualizar o webhook inbound para processar tipos de mídia
3. Adicionar funções de envio de mídia (outbound)
4. Atualizar a UI para exibir e enviar mídias

### Implementação

**1. Migração SQL**
- `ALTER TABLE lead_messages ADD COLUMN`:
  - `tipo_midia` TEXT DEFAULT 'text' — tipo da mensagem (text, image, document, audio, video, sticker, location, contacts)
  - `media_url` TEXT — URL do arquivo (após download da Meta ou upload para Storage)
  - `media_mime_type` TEXT — MIME type (image/jpeg, application/pdf, etc.)
  - `media_filename` TEXT — nome do arquivo original (para documentos)
  - `media_caption` TEXT — legenda da mídia (Meta suporta caption em image/document/video)
  - `media_meta_id` TEXT — ID da mídia na Meta (para download via Graph API)

**2. Storage Bucket**
- Criar bucket `whatsapp-media` (público) para armazenar mídia baixada
- RLS: service_role pode inserir, authenticated pode ler

**3. Atualizar `meta-webhook/index.ts`** — Inbound
- Expandir `handleMessage` para processar tipos além de texto:
  - `image` → extrair `image.id`, `image.mime_type`, `image.caption`
  - `document` → extrair `document.id`, `document.mime_type`, `document.filename`
  - `audio` → extrair `audio.id`, `audio.mime_type`
  - `video` → extrair `video.id`, `video.mime_type`, `video.caption`
  - `sticker` → extrair `sticker.id`, `sticker.mime_type`
  - `location` → extrair `location.latitude`, `location.longitude`, `location.name`
- Adicionar função `downloadMetaMedia(mediaId)` → baixa via `GET graph.facebook.com/v21.0/{mediaId}` → obtém URL → faz download → salva no Storage bucket → retorna URL pública
- Salvar `tipo_midia`, `media_url`, `media_mime_type`, `media_filename`, `media_caption`, `media_meta_id` no `lead_messages`

**4. Novo helper em `channel-resolver.ts`** — Outbound
- `sendImageViaMetaCloud(config, to, imageUrl, caption?)` → envia imagem
- `sendDocumentViaMetaCloud(config, to, documentUrl, filename?, caption?)` → envia documento
- `sendAudioViaMetaCloud(config, to, audioUrl)` → envia áudio

**5. Atualizar `whatsapp-send/index.ts`**
- Aceitar novos campos: `mediaType`, `mediaUrl`, `mediaCaption`, `mediaFilename`
- No ramo `meta_cloud`, rotear para a função de envio de mídia correta baseado no `mediaType`

**6. Frontend — Exibição de mídia na timeline de mensagens**
- Atualizar componente de mensagem para renderizar mídias:
  - Imagem: `<img>` com lightbox
  - Documento: link de download com ícone
  - Áudio: player `<audio>`
  - Vídeo: player `<video>`
  - Location: texto com coordenadas

### Arquivos impactados
| Arquivo | Ação |
|---------|------|
| Migração SQL | Colunas mídia em `lead_messages` + bucket `whatsapp-media` |
| `supabase/functions/meta-webhook/index.ts` | Processar tipos de mídia inbound + download |
| `supabase/functions/_shared/channel-resolver.ts` | Helpers de envio de mídia |
| `supabase/functions/whatsapp-send/index.ts` | Aceitar e rotear mídia outbound |
| `src/types/messaging.ts` | Atualizar tipos |
| Componentes de mensagem (timeline) | Renderizar mídia |
| `.lovable/plan.md` | Atualizar com Fase 4 |

