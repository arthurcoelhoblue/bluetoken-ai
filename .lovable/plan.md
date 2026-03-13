

## Problema: Áudios inbound chegam como "indisponível"

### Diagnóstico

Os logs confirmam o erro:
```
ERROR: Failed to get media URL — mediaId: 895281329989070, status: 400
```

A função `downloadMetaMedia` na edge function `meta-webhook` **não recebe a empresa nem o phoneNumberId** do contexto da mensagem. Ela tenta buscar o token de formas genéricas (env vars com nomes fixos, ou pega qualquer conexão aleatória), resultando em:
- Usar token da empresa errada
- Ou não encontrar token nenhum

Enquanto isso, o sistema já tem a lógica correta no `channel-resolver.ts` que resolve o token por empresa/conexão — usado pelo `whatsapp-send` e `cadence-runner`. Basta reutilizar.

### Correção

Alterar `downloadMetaMedia` para receber `empresa` e `phoneNumberId`, e usar `resolveMetaCloudConfig` do `channel-resolver.ts` para obter o token correto.

**Arquivo:** `supabase/functions/meta-webhook/index.ts`

1. **Importar** `resolveMetaCloudConfig` de `../_shared/channel-resolver.ts`

2. **Alterar assinatura** de `downloadMetaMedia` para receber `empresa` e `phoneNumberId`:
```typescript
async function downloadMetaMedia(
  supabase, mediaId, mimeType, empresa, phoneNumberId
)
```

3. **Substituir a lógica de resolução de token** — em vez do fallback frágil atual (env vars genéricas + conexão aleatória), usar:
```typescript
// Resolve token via channel-resolver (mesma lógica do whatsapp-send)
const config = await resolveMetaCloudConfig(supabase, empresa);
const accessToken = config.metaAccessToken;
if (!accessToken) {
  log.error("No Meta access token for empresa", { empresa });
  return null;
}
return await doDownload(supabase, mediaId, mimeType, accessToken);
```

4. **Atualizar a chamada** no `handleMessage` (linha ~637) para passar os parâmetros:
```typescript
mediaUrl = await downloadMetaMedia(
  supabase, mediaInfo.media_meta_id, mediaInfo.media_mime_type,
  resolvedEmpresa, phoneNumberId
);
```

### Impacto
- Corrige download de áudios, imagens, vídeos e documentos inbound
- Usa o mesmo padrão confiável que já funciona no envio de mensagens
- Nenhuma mudança de banco necessária

