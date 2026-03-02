

## Plano: Campos de Credenciais Meta Cloud por Empresa

### Problema
O card "WhatsApp Business Oficial" (Meta Cloud) na aba Canais permite apenas ativar/desativar por empresa. Não há campos para cadastrar o **Access Token** e **App Secret** necessários para a integração funcionar.

### O que será criado

Adicionar campos de configuração no `CompanyChannelCard` para o canal `meta_cloud`, similar ao que já existe para `mensageria` (que tem campos API Key e Connection Name).

Quando o canal for `meta_cloud` e estiver ativo, exibir:
- **Access Token** (campo password com toggle de visibilidade)
- **App Secret** (campo password com toggle de visibilidade, usado para validação de assinatura no webhook)
- Botão "Salvar" que aparece quando há mudanças

### Onde os dados serão salvos

Os valores serão salvos na tabela `system_settings` com:
- `category`: `integrations`  
- `key`: `meta_cloud_<empresa>` (ex: `meta_cloud_blue`)
- `value`: `{ "enabled": true, "access_token": "...", "app_secret": "..." }`

Isso é compatível com o `channel-resolver.ts` que já lê `access_token` de `system_settings` com essa mesma chave. O `META_APP_SECRET` usado no `meta-webhook` também passará a ser lido por empresa.

### Alterações

1. **`CompanyChannelCard.tsx`**: Criar componente `MetaCloudConfigFields` (análogo ao `MensageriaConfigFields` existente) com campos Access Token e App Secret, salvando via upsert em `system_settings`.

2. **Sem migração de banco** — a tabela `system_settings` já existe e aceita qualquer JSON no campo `value`.

