

## Plano: Refatorar para usar Mensageria como canal único (remover meta_cloud)

### Contexto

A Mensageria (`dev-mensageria.grupoblue.com.br`) já é um wrapper sobre a API oficial da Meta Cloud. O sistema atual tem um canal `meta_cloud` que faz chamadas diretas à Graph API da Meta, duplicando funcionalidade. A refatoração unificará tudo sob a Mensageria.

**Endpoints da Mensageria** (extraídos do repositório GitHub):
- **Texto livre**: `POST /whatsapp?token={connectionName}` — body: `{ phone, message }`
- **Template**: via `whatsappBusiness` router — `sendTemplateMessage({ phoneNumberId, accessToken, recipientPhone, templateName, templateLanguage, bodyParams })`
- **Mídia**: suportado via Mensageria (imagem, documento, áudio, vídeo)
- **Autenticação**: header `X-API-Key` (já usado hoje via `MENSAGERIA_API_KEY`)
- **Webhooks inbound/status**: Mensageria envia para URL configurada por conexão

A API REST da Mensageria expõe:
- `POST /api/whatsapp/send-message` (já usada no `whatsapp-send/index.ts`)
- Templates e campanhas gerenciados internamente pela Mensageria via Meta API

### Arquivos afetados

---

**1. `supabase/functions/whatsapp-send/index.ts`**
- Remover todo o bloco `else if (activeChannel === 'meta_cloud')` (~80 linhas)
- Remover imports de `channel-resolver.ts` para funções Meta (`resolveMetaCloudConfig`, `sendTextViaMetaCloud`, `sendTemplateViaMetaCloud`, etc.)
- Remover campos `metaTemplateName`, `metaLanguage`, `metaComponents` do request interface (templates serão gerenciados pela Mensageria)
- O roteamento final fica: `bluechat` → `sendViaBluechat()`, qualquer outro → `sendViaMensageria()`
- Atualizar `sendViaMensageria` para aceitar opcionalmente campos de mídia (`mediaType`, `mediaUrl`, etc.) no payload enviado à API

**2. `supabase/functions/_shared/channel-resolver.ts`**
- Remover `META_CLOUD` do type `ChannelMode`
- Remover funções: `resolveMetaCloudConfig`, `sendTemplateViaMetaCloud`, `sendTextViaMetaCloud`, `sendImageViaMetaCloud`, `sendDocumentViaMetaCloud`, `sendAudioViaMetaCloud`, `sendVideoViaMetaCloud`, `sendMediaViaMetaCloud`
- Remover interfaces `MetaTemplateSendParams` e tipos relacionados
- O `resolveChannelConfig` retorna apenas `BLUECHAT` ou `DIRECT`

**3. `supabase/functions/meta-webhook/index.ts`**
- Remover completamente este edge function (inbound e status de delivery virão via webhook da Mensageria, que já aponta para `whatsapp-inbound`)
- Deletar o deploy da edge function

**4. `src/hooks/useChannelConfig.ts`**
- Remover `meta_cloud` do type `ActiveChannel`
- Remover `isMetaCloud` do resultado

**5. `src/hooks/useIntegrationCompanyConfig.ts`**
- Remover `meta_cloud` do type `ChannelType`
- Remover `meta_cloud` do mapa de labels

**6. UI de Settings (tela de canais)**
- Remover opção "Meta Cloud API" do seletor de canal
- Apenas "Mensageria" e "Blue Chat" ficam disponíveis

**7. Tabela `whatsapp_connections`**
- Manter a tabela mas não depender mais dela para roteamento de envio
- Os campos `phone_number_id` e `business_account_id` ficam como referência, mas não são mais usados no fluxo de envio

**8. Banco de dados**
- Migração: `UPDATE integration_company_config SET channel = 'mensageria', enabled = true WHERE channel = 'meta_cloud'`
- Garante que empresas que estavam em `meta_cloud` migrem para `mensageria`

---

### Configuração necessária na Mensageria

Para que templates e status de delivery funcionem:
1. **Webhook inbound** da conexão na Mensageria deve apontar para a URL do `whatsapp-inbound` edge function
2. **Templates** são gerenciados diretamente na interface da Mensageria (não mais pelo nosso sistema)
3. A `MENSAGERIA_API_KEY` já está configurada como secret

### Resumo das mudanças

| Item | Ação |
|---|---|
| Canal `meta_cloud` | Removido completamente |
| `meta-webhook` edge function | Deletada |
| `channel-resolver.ts` | Limpeza das funções Meta Cloud (~200 linhas) |
| `whatsapp-send/index.ts` | Simplificado: só bluechat ou mensageria (~80 linhas removidas) |
| Hooks frontend | Tipo e flag `isMetaCloud` removidos |
| UI Settings | Opção Meta Cloud removida |
| Migração DB | Empresas em `meta_cloud` → `mensageria` |

