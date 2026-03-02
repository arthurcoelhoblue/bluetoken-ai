

## Problema Atual

O sistema hoje permite **apenas um número WhatsApp ativo por empresa** — imposto pelo índice único `idx_whatsapp_connections_empresa_active ON whatsapp_connections (empresa) WHERE is_active = true`. A tabela `whatsapp_connections` tem apenas 1 registro (TOKENIZA). Toda a lógica de envio (channel-resolver, whatsapp-send, meta-webhook) assume um único número por empresa.

## Plano de Implementação

### 1. Migration — Permitir múltiplos números por empresa

- **Dropar** o índice único `idx_whatsapp_connections_empresa_active`
- **Adicionar colunas** em `whatsapp_connections`:
  - `label TEXT` — nome amigável do número (ex: "Comercial", "Suporte")
  - `is_default BOOLEAN DEFAULT false` — número padrão quando nenhum é escolhido
- **Criar índice único** em `(empresa, is_default) WHERE is_default = true` — garante apenas 1 default por empresa
- **Adicionar coluna** `from_phone_number_id TEXT` em `lead_messages` — rastrear qual número enviou cada mensagem
- **RLS**: manter políticas existentes

### 2. Backend — Atualizar Edge Functions

**`_shared/channel-resolver.ts`**:
- Alterar `resolveMetaCloudConfig` para aceitar `connectionId` opcional
- Se `connectionId` fornecido, buscar por `id`; senão, buscar pelo `is_default = true` (ou o primeiro ativo)
- Nova função `listActiveConnections(empresa)` para listar números disponíveis

**`whatsapp-send/index.ts`**:
- Aceitar novo campo `connectionId` no body da request
- Passar para o channel-resolver para selecionar o número correto
- Salvar `from_phone_number_id` no registro de `lead_messages`

**`meta-webhook/index.ts`**:
- Já resolve empresa por `phone_number_id` — funciona sem mudança (cada número no webhook já é mapeado corretamente)

### 3. Frontend — Seletor de número de origem

**Novo componente `ConnectionPicker`** (`src/components/conversas/ConnectionPicker.tsx`):
- Select/dropdown que lista os números ativos da empresa via query em `whatsapp_connections`
- Mostra `label` + `display_phone` (ou `verified_name`)
- Pré-seleciona o `is_default`

**`TemplatePickerDialog.tsx`**:
- Integrar o `ConnectionPicker` antes do botão "Enviar Template"
- Passar `connectionId` selecionado para o `whatsapp-send`

**`ManualMessageInput.tsx`**:
- Quando a empresa tem mais de 1 número ativo, mostrar o `ConnectionPicker` inline
- Passar `connectionId` para `useSendManualMessage`

**`useConversationMode.ts`**:
- `useSendManualMessage` aceitar `connectionId` opcional e passá-lo ao `whatsapp-send`

### 4. Fluxo do Usuário

```text
Conversa aberta → Usuário digita mensagem
  ├─ Empresa tem 1 número → envia direto (sem seletor)
  └─ Empresa tem 2+ números → mostra dropdown "Enviar de:"
       └─ Seleção do número + envio

Template (primeira msg / 24h expirada):
  └─ TemplatePickerDialog abre
       ├─ Seletor de número de origem (topo)
       ├─ Lista de templates aprovados
       └─ Botão "Enviar Template"
```

### 5. Detalhes Técnicos

- A tabela `whatsapp_connections` já tem `display_phone` e `verified_name` — servem para exibição no picker
- O `meta-webhook` inbound continua funcionando sem mudanças pois já resolve empresa via `phone_number_id`
- O `from_phone_number_id` em `lead_messages` é útil para auditoria e para saber de qual número veio a resposta
- Empresas que usam canal `mensageria` (Baileys) não são afetadas — continuam com config em `integration_company_config`

### Arquivos a modificar/criar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Dropar índice único, add colunas |
| `supabase/functions/_shared/channel-resolver.ts` | Aceitar `connectionId`, add `listActiveConnections` |
| `supabase/functions/whatsapp-send/index.ts` | Aceitar `connectionId`, salvar `from_phone_number_id` |
| `src/components/conversas/ConnectionPicker.tsx` | **Novo** — dropdown de números |
| `src/components/conversas/TemplatePickerDialog.tsx` | Integrar ConnectionPicker |
| `src/components/conversas/ManualMessageInput.tsx` | Integrar ConnectionPicker condicional |
| `src/hooks/useConversationMode.ts` | Add `connectionId` ao send |

