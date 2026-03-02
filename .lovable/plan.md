

## Plano: Credenciais Meta por Conexão (não por Empresa)

### Problema atual

O Access Token e App Secret foram implementados **por empresa** via `system_settings`. Mas na prática, uma mesma empresa pode ter múltiplos números em apps Meta diferentes (ex: Tokeniza). Cada conexão WhatsApp precisa do seu próprio par de credenciais.

### Solução

Mover Access Token e App Secret para dentro de cada **conexão WhatsApp** (`whatsapp_connections`), nos campos do dialog de adicionar/editar.

### Alterações

**1. Migração de banco** — Adicionar colunas `access_token` e `app_secret` à tabela `whatsapp_connections`:
```sql
ALTER TABLE public.whatsapp_connections 
  ADD COLUMN access_token text,
  ADD COLUMN app_secret text;
```

**2. `AddEditConnectionDialog.tsx`** — Adicionar campos Access Token e App Secret (com toggle de visibilidade) ao formulário existente. Os valores serão salvos direto na conexão.

**3. `WhatsAppConnectionsManager.tsx`** — Passar `access_token` e `app_secret` no create/update mutation.

**4. `CompanyChannelCard.tsx`** — Remover o componente `MetaCloudConfigFields` (não é mais necessário).

**5. `channel-resolver.ts` (edge function)** — Alterar `resolveMetaCloudConfig` para ler `access_token` direto da conexão em vez de buscar em `system_settings`. Fallback para `system_settings` e env var mantido por compatibilidade.

### Resultado

Cada número WhatsApp terá seu próprio Access Token e App Secret, configurados no mesmo lugar onde se cadastra o número. Funciona para cenários com múltiplos apps Meta na mesma empresa.

