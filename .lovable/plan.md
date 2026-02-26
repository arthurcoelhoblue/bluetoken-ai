

## Fase 1: Gestão de Templates via Meta Cloud API

### Contexto
A Fase 0 completou parcialmente — a constraint de `channel` foi expandida e rows `meta_cloud` inseridas em `integration_company_config`. Porém, a tabela `whatsapp_connections` e as colunas Meta em `message_templates` **não foram criadas**. Fase 1 inclui esses pendentes.

### Implementação

**1. Migração SQL** (pendente da Fase 0 + Fase 1)
- `CREATE TABLE whatsapp_connections` (empresa, phone_number_id, business_account_id, display_phone, verified_name, is_active) + RLS (admin write, authenticated read)
- `ALTER TABLE message_templates ADD COLUMN` para: `meta_template_id`, `meta_status` (default 'LOCAL'), `meta_category`, `meta_language` (default 'pt_BR'), `meta_components` (JSONB), `meta_rejected_reason`

**2. Edge function `whatsapp-template-manager/index.ts`** (nova)
- `GET` → Lista templates da WABA via `GET graph.facebook.com/v21.0/{businessAccountId}/message_templates`
- `POST` → Cria template via `POST graph.facebook.com/v21.0/{businessAccountId}/message_templates` + sincroniza com `message_templates` local
- `DELETE` → Remove template via `DELETE graph.facebook.com/v21.0/{businessAccountId}/message_templates?name={name}`
- `PATCH` → Sincroniza status dos templates locais com status na Meta (batch)
- Usa `resolveMetaCloudConfig()` do `channel-resolver.ts` para credenciais

**3. Frontend — Expandir `useTemplates.ts`**
- Adicionar campos Meta ao tipo `MessageTemplate` (meta_template_id, meta_status, meta_category, etc.)
- Novo hook `useSyncMetaTemplates()` para chamar o PATCH de sincronização
- Novo hook `useSubmitTemplateToMeta()` para submeter template local à Meta

**4. Frontend — Expandir `TemplateFormDialog.tsx`**
- Novo campo `meta_category` (select: UTILITY / MARKETING / AUTHENTICATION)
- Novo campo `meta_language` (default pt_BR)
- Exibir `meta_status` como badge (LOCAL / PENDING / APPROVED / REJECTED)
- Exibir `meta_rejected_reason` quando rejeitado
- Editor de `meta_components` (JSONB) para header/body/footer/buttons — versão simplificada com campos de texto por componente

**5. Frontend — Expandir `TemplatesPage.tsx`**
- Coluna `Status Meta` na tabela com badge colorido (LOCAL=cinza, PENDING=amarelo, APPROVED=verde, REJECTED=vermelho)
- Botão "Sincronizar com Meta" no header para buscar status atualizado
- Botão "Submeter à Meta" no formulário para templates LOCAL
- Filtro por `meta_status`

**6. Atualizar `whatsapp-send/index.ts`**
- Adicionar terceiro ramo no roteamento: `else if (activeChannel === 'meta_cloud')` → chamar `sendViaMetaCloud()` usando helpers do `channel-resolver.ts`

### Arquivos impactados
| Arquivo | Ação |
|---------|------|
| Migração SQL | `whatsapp_connections` + colunas Meta em `message_templates` |
| `supabase/functions/whatsapp-template-manager/index.ts` | **Novo** |
| `src/hooks/useTemplates.ts` | Expandir tipos + novos hooks |
| `src/components/templates/TemplateFormDialog.tsx` | Campos Meta |
| `src/pages/TemplatesPage.tsx` | Coluna status Meta + botões sync |
| `supabase/functions/whatsapp-send/index.ts` | Ramo `meta_cloud` |
| `src/types/messaging.ts` | Atualizar `MessageTemplate` |

