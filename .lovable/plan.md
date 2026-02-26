

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

### Próximas Fases
- **Fase 2**: Envio de templates Meta + mensagens de texto via janela 24h
- **Fase 3**: Inbound webhooks Meta (recepção de mensagens + status updates)
