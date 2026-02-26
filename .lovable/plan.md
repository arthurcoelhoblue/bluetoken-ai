

## Revisão Final do Plano Consolidado

Revisei o código existente, o schema do banco, e os dados atuais. O plano está **completo e coerente**, com algumas observações e ajustes necessários:

---

### O que está correto e pronto

1. **Fase 0 — `whatsapp_connections`**: A tabela proposta cobre tudo. O `channel` em `integration_company_config` é `TEXT` (não enum), então adicionar `'meta_cloud'` não requer ALTER TYPE — basta INSERT.

2. **Fase 1 — Templates Meta**: A tabela `message_templates` hoje tem: `id, empresa, canal, codigo, nome, descricao, conteudo, ativo, assunto_template, created_at, updated_at`. As colunas novas propostas (`meta_template_id, meta_status, meta_category, meta_language, meta_components, meta_rejected_reason`) são extensões limpas, sem conflito.

3. **Fase 2 — `whatsapp-send`**: O roteamento atual (linhas 389-404) já tem `if (activeChannel === 'bluechat') ... else ...`. Adicionar `else if (activeChannel === 'meta_cloud')` com `sendViaMetaCloud()` é cirúrgico.

4. **Fase 3 — Webhook Inbound**: A edge function `meta-webhook-handler` é nova. O `whatsapp-inbound` existente é acoplado à Mensageria/Baileys. O `bluechat-inbound` é acoplado ao Blue Chat. Nenhum dos dois serve para Meta Cloud direta — confirma a necessidade de criar do zero.

5. **Fase 4 — Toggle**: `integration_company_config` já tem dados para 4 empresas (BLUE, TOKENIZA, MPUPPE, AXIA) com `bluechat/mensageria`. Basta inserir rows com `channel = 'meta_cloud'`.

---

### Ajustes e gaps identificados

| # | Item | Observação |
|---|------|------------|
| 1 | **`enforce_channel_exclusivity` trigger** | Hoje desativa outros canais da mesma empresa quando um é ativado. Com 3 canais (`bluechat`, `mensageria`, `meta_cloud`), o trigger funciona corretamente — ao ativar `meta_cloud`, desativa os outros dois. **OK, sem alteração.** |
| 2 | **`useChannelConfig.ts` no frontend** | Hoje retorna `isBluechat / isMensageria` como booleanos. Precisa ser refatorado para retornar o canal ativo como string (`'bluechat' | 'mensageria' | 'meta_cloud'`) para suportar lógica de UI condicional. |
| 3 | **`useIntegrationCompanyConfig.ts`** | O tipo `ChannelType` é `'bluechat' | 'mensageria'`. Precisa adicionar `'meta_cloud'`. |
| 4 | **`channel-resolver.ts`** | O tipo `ChannelMode` é `'DIRECT' | 'BLUECHAT'`. Precisa adicionar `'META_CLOUD'` e a interface `ChannelConfig` precisa de `metaPhoneNumberId` e `metaAccessToken`. |
| 5 | **BLUE_LABS** | Não tem rows em `integration_company_config`. Precisa ser incluída na Fase 0. |
| 6 | **Secrets por empresa** | O plano menciona `META_ACCESS_TOKEN_BLUE` (um por empresa). Isso é correto, mas a alternativa de guardar na `system_settings` (como já é feito para Blue Chat) também funciona e mantém consistência. **Recomendação: usar `system_settings` com key `meta_cloud_blue`, `meta_cloud_tokeniza`, etc.** |
| 7 | **`amelia-mass-action`** | Precisa ser listada como impactada na Fase 3 — hoje envia texto livre, precisa suportar seleção de template aprovado. |
| 8 | **`TemplatesPage.tsx` / `TemplateFormDialog`** | UI precisa de expansão para exibir: `meta_status` (badge APPROVED/PENDING/REJECTED), `meta_category`, e editor de `meta_components` (header/body/footer/buttons). |

---

### Ordem de implementação recomendada

```text
Fase 0: Infraestrutura (1 implementação)
├── Migração: CREATE TABLE whatsapp_connections + RLS
├── Migração: ALTER TABLE message_templates ADD colunas Meta
├── Migração: INSERT meta_cloud rows em integration_company_config
├── Atualizar channel-resolver.ts (tipo META_CLOUD + resolveMetaCloudConfig)
├── Atualizar useChannelConfig.ts + useIntegrationCompanyConfig.ts
└── Configurar secrets (META_ACCESS_TOKEN por empresa + META_WEBHOOK_VERIFY_TOKEN)

Fase 1: Edge function whatsapp-template-manager (CRUD)
├── GET: listar templates da WABA via Meta Business API
├── POST: criar template + sincronizar com message_templates
├── DELETE: deletar template
└── UI: expandir TemplatesPage com campos Meta

Fase 2: Envio via Meta Cloud
├── Adicionar sendViaMetaCloud() no whatsapp-send
├── Roteamento: activeChannel === 'meta_cloud'
└── Modificar amelia-mass-action para selecionar template

Fase 3: Webhook Inbound Meta
├── Edge function meta-webhook-handler (GET verify + POST events)
├── Processar status updates (ENVIADO/ENTREGUE/LIDO/ERRO)
└── Processar mensagens inbound → lead_messages + amelia-brain

Fase 4: Toggle e migração
├── Ativar meta_cloud para empresas comerciais
├── Manter bluechat para CS
└── Testes end-to-end
```

### Conclusão

O plano está **completo**. Os 8 ajustes listados acima são refinamentos, não gaps estruturais. Podemos iniciar pela **Fase 0** quando você autorizar.

