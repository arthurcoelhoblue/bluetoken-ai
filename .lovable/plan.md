

## Configuração Meta Cloud API — Tokeniza

### Estado atual
- `whatsapp_connections`: Nenhum registro para TOKENIZA
- `integration_company_config`: Apenas canal `mensageria` (inativo)
- `system_settings`: Sem token configurado para Tokeniza

### Passos de implementação

1. **Inserir `whatsapp_connections`** para TOKENIZA com:
   - `phone_number_id`: `1009376255595711`
   - `business_account_id`: `1601079981216550`
   - `is_active`: true

2. **Inserir `integration_company_config`** para canal `meta_cloud` + TOKENIZA (enabled: true)
   - O trigger `enforce_channel_exclusivity` desativará automaticamente o canal `mensageria`

3. **Inserir `system_settings`** com chave `meta_cloud_tokeniza` para armazenar o access token
   - O token já está no secret `META_ACCESS_TOKEN_TOKENIZA`
   - O `channel-resolver.ts` busca primeiro em `system_settings`, depois em env vars — vamos usar o env var (secret já configurado), sem necessidade de duplicar no banco

### Resultado
Após as migrações, o canal `meta_cloud` estará ativo para TOKENIZA, usando o Phone Number ID e WABA ID fornecidos, com o token de acesso lido do secret `META_ACCESS_TOKEN_TOKENIZA`.

