
## Remover Integração Blue Chat Completamente

A integração com o Blue Chat está presente em ~40 arquivos (frontend + backend). Abaixo está o plano completo de remoção, mantendo apenas **Mensageria (Baileys)** e **WhatsApp Business Oficial (meta_cloud)**.

---

### 1. Edge Functions — Deletar

Remover completamente as seguintes Edge Functions:

- **`supabase/functions/bluechat-inbound/`** (11 arquivos) — Webhook de entrada do Blue Chat
- **`supabase/functions/bluechat-proxy/`** (1 arquivo) — Proxy para envio de mensagens, transferência de tickets e listagem de agentes

### 2. Edge Functions — Limpar referências Blue Chat

**`supabase/functions/_shared/channel-resolver.ts`**:
- Remover `ChannelMode = 'BLUECHAT'` (manter apenas `'DIRECT' | 'META_CLOUD'`)
- Remover `bluechatApiUrl`, `bluechatApiKey` do `ChannelConfig`
- Deletar funções: `resolveBluechatApiKey`, `resolveBluechatWebhookSecret`, `resolveBluechatConfig`, `resolveBluechatFrontendUrl`, `sendViaBluechat`, `openBluechatConversation`
- Remover `SETTINGS_KEY_MAP` das empresas Blue Chat
- Simplificar `resolveChannelConfig` para retornar `META_CLOUD` ou `DIRECT`

**`supabase/functions/_shared/empresa-mapping.ts`**:
- Remover `mapBluechatEmpresa` e `BLUECHAT_EMPRESA_MAP`

**`supabase/functions/whatsapp-send/index.ts`**:
- Remover toda a função `sendViaBluechat`
- Remover bloco `if (activeChannel === 'bluechat')` no roteamento principal

**`supabase/functions/cadence-runner/index.ts`**:
- Remover import de `sendViaBluechat`, `openBluechatConversation`
- Remover função `dispararViaBluechat` e o branch `channelConfig.mode === 'BLUECHAT'`

**`supabase/functions/sdr-ia-interpret/index.ts`** e **`action-executor.ts`**:
- Remover todas as condições `source === 'BLUECHAT'` (anti-limbo, escalation, response handling)
- Simplificar lógica para tratar apenas `WHATSAPP` / `META_CLOUD`

**`supabase/functions/sdr-proactive-outreach/index.ts`**:
- Remover `resolveBlueChat()` e toda a lógica de envio via Blue Chat
- Redirecionar o envio proativo para usar Mensageria ou Meta Cloud conforme canal ativo

**`supabase/functions/integration-health-check/index.ts`**:
- Remover `checkBlueChat()` e referências no health check cron e no switch

### 3. Frontend — Deletar arquivos

- **`src/utils/bluechat.ts`** — Deep link builder
- **`src/components/settings/BlueChatConfigDialog.tsx`** — Dialog de configuração

### 4. Frontend — Limpar referências

**`src/hooks/useChannelConfig.ts`**:
- Remover `'bluechat'` do tipo `ActiveChannel` (manter `'mensageria' | 'meta_cloud'`)
- Remover `isBluechat` do resultado

**`src/hooks/useConversationMode.ts`**:
- Remover `bluechatConversationId` do `SendManualParams`
- Remover todo o bloco de envio via `bluechat-proxy`

**`src/hooks/useIntegrationCompanyConfig.ts`**:
- Remover `'bluechat'` do `ChannelType` e `CHANNEL_LABELS`

**`src/hooks/useOperationalHealth.ts`**:
- Remover `{ name: 'bluechat', label: 'Blue Chat' }` dos health checks

**`src/components/conversas/ManualMessageInput.tsx`**:
- Remover prop `bluechatConversationId`
- Remover todo o bloco `if (isBluechat)` (botão "Abordar via Amélia" + envio Blue Chat)
- Remover import de `useChannelConfig`

**`src/components/conversas/ConversationPanel.tsx`**:
- Remover state `bluechatConversationId`, useEffect de fetch, deep link badge
- Remover imports de `buildBluechatDeepLink`, `useChannelConfig`
- Remover prop `bluechatConversationId` dos componentes filhos

**`src/components/conversas/ConversationTakeoverBar.tsx`**:
- Remover `BlueChatAgent` interface e state `blueChatAgents`
- Remover fetch de agentes via `bluechat-proxy`
- Remover lógica de transferência de ticket Blue Chat
- Remover badge "Blue Chat" e seção "Atendentes Blue Chat" no select
- Remover import `buildBluechatDeepLink`

**`src/components/settings/IntegrationsTab.tsx`**:
- Remover `BlueChatConfigDialog` e todo state relacionado (`blueChatDialogOpen`, `blueChatHealthStatus`)
- Remover auto health check do Blue Chat no `useEffect`

**`src/components/settings/CompanyChannelCard.tsx`**:
- Remover condição especial para `integration.id === 'bluechat'`

**`src/types/settings.ts`**:
- Remover entry `'bluechat'` do array `INTEGRATIONS`
- Remover entry `'bluechat-inbound'` de `WEBHOOK_ENDPOINTS`
- Remover `'bluechat'` do tipo de `channel` na interface

**`src/pages/ConversasPage.tsx`**:
- Atualizar subtítulo de "Blue Chat & WhatsApp" para "WhatsApp"

### 5. Dados — Limpar configurações (opcional, pós-deploy)

- Inativar registros `integration_company_config` onde `channel = 'bluechat'`
- Limpar settings `bluechat_*` em `system_settings`

---

### Resumo de impacto

| Area | Arquivos deletados | Arquivos editados |
|------|-------------------|-------------------|
| Edge Functions | 12 (2 funções) | 7 |
| Frontend | 2 | 11 |
| **Total** | **14** | **18** |

Os canais restantes (Mensageria + Meta Cloud API) continuarão funcionando sem alteração na lógica de negócio. O roteamento via `integration_company_config` permanece intacto para esses dois canais.
