

## Fase 1: Gestão de Templates via Meta Cloud API ✅

### Status: CONCLUÍDA

### O que foi implementado:

**1. Migração SQL** ✅
- `whatsapp_connections` criada com RLS (authenticated read, service_role write)
- `message_templates` expandida com: `meta_template_id`, `meta_status`, `meta_category`, `meta_language`, `meta_components`, `meta_rejected_reason`

**2. Edge function `whatsapp-template-manager`** ✅
- `GET` → Lista templates da WABA
- `POST` → Cria template na Meta + sync local
- `DELETE` → Remove template da Meta + reset local
- `PATCH` → Sincroniza status batch dos templates locais com Meta

**3. Frontend — `useTemplates.ts`** ✅
- Tipo `MessageTemplate` expandido com campos Meta
- `useSyncMetaTemplates()` — sincroniza status via PATCH
- `useSubmitTemplateToMeta()` — submete template LOCAL à Meta

**4. Frontend — `TemplateFormDialog.tsx`** ✅
- Campo `meta_category` (UTILITY / MARKETING / AUTHENTICATION)
- Campo `meta_language` (pt_BR / en_US / es)
- Badge `meta_status` no header do dialog
- Editor `MetaComponentsEditor` para HEADER / BODY / FOOTER / BUTTONS

**5. Frontend — `TemplatesPage.tsx`** ✅
- Coluna "Status Meta" com badge colorido
- Botão "Sincronizar Meta" no header
- Botão "Submeter à Meta" (ícone Send) para templates LOCAL com categoria definida
- Filtro por `meta_status`

**6. `whatsapp-send`** ✅
- Ramo `meta_cloud` adicionado ao roteamento

---

## Fase 2: Envio de Templates Meta + Janela 24h ✅

### Status: CONCLUÍDA

### O que foi implementado:

**1. Migração SQL** ✅
- `lead_conversation_state.last_inbound_at` — rastreia última mensagem inbound para validação de janela 24h
- `mass_action_jobs.template_id` — referência a template Meta para ações em massa baseadas em template
- `mass_action_jobs.template_variables` — mapeamento de variáveis para placeholders do template

**2. `whatsapp-send` atualizado** ✅
- Aceita `metaTemplateName`, `metaLanguage`, `metaComponents` para envio de template
- Envio de template via `sendTemplateViaMetaCloud()` quando parâmetros Meta presentes
- Validação de janela 24h para texto livre via Meta Cloud: verifica `last_inbound_at` antes de permitir envio
- Erro claro quando fora da janela: "Envie um template aprovado para reabrir a conversa"

**3. `cadence-runner` atualizado** ✅
- Busca `meta_template_id`, `meta_status`, `meta_language`, `meta_components` do template ao disparar
- Quando template tem `meta_template_id` com `meta_status = 'APPROVED'`, envia como template Meta Cloud
- Passa parâmetros Meta para `whatsapp-send` automaticamente

**4. `amelia-mass-action` atualizado** ✅
- Suporte a `template_id` no job para ações em massa baseadas em template
- Quando `template_id` presente, busca info Meta e inclui no payload do `whatsapp-send`
- Templates Meta Cloud são usados ao invés de mensagens geradas por IA

### Próximas Fases
- **Fase 3**: Inbound webhooks Meta (recepção de mensagens + status updates)
