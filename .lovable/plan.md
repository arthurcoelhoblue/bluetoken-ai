

## Fase 3: Webhook Meta Cloud — ✅ CONCLUÍDA

### O que foi implementado
1. **`supabase/functions/meta-webhook/index.ts`** — Edge function completa:
   - **GET**: Webhook verification da Meta (`hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`)
   - **POST Messages**: Extrai `from`, `id`, `timestamp`, `text.body` → normaliza telefone → salva em `lead_messages` → atualiza `last_inbound_at` → dispara `sdr-ia-interpret`
   - **POST Statuses**: Mapeia `sent→ENVIADO`, `delivered→ENTREGUE`, `read→LIDO`, `failed→FALHA` e atualiza `lead_messages.estado` pelo `whatsapp_message_id`
   - **Segurança**: Validação de assinatura `X-Hub-Signature-256` (HMAC SHA256 com `META_APP_SECRET`)
2. **`supabase/config.toml`** — Adicionado `[functions.meta-webhook]` com `verify_jwt = false`
3. **`src/types/settings.ts`** — Novo webhook entry `meta-webhook` na lista de webhooks

### Secrets necessários
- `META_WEBHOOK_VERIFY_TOKEN` — Token de verificação do handshake Meta
- `META_APP_SECRET` — App Secret para validação de assinatura HMAC (opcional durante setup inicial)
