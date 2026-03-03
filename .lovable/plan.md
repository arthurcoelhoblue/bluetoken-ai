

## Templates por Número WhatsApp

### Contexto

Hoje a tabela `message_templates` vincula templates apenas à `empresa`. Na API oficial da Meta, templates são registrados por **WABA (WhatsApp Business Account)**, que está associado a um `phone_number_id` específico. Com múltiplos números por empresa (ex: Tokeniza tem 2), é necessário saber qual número possui qual template aprovado.

### Solução

Adicionar um campo `connection_id` (FK para `whatsapp_connections`) na tabela `message_templates`, permitindo vincular templates a números específicos.

### Mudanças

**1. Migração SQL**
- Adicionar coluna `connection_id UUID REFERENCES whatsapp_connections(id) ON DELETE SET NULL` (nullable para manter compatibilidade com templates existentes e templates de EMAIL)

**2. `src/components/templates/TemplateFormDialog.tsx`**
- Quando `canal = WHATSAPP`, exibir um `ConnectionPicker` filtrado pela empresa selecionada para o usuário escolher o número
- Salvar o `connection_id` no payload

**3. `src/hooks/useTemplates.ts`**
- Adicionar `connection_id` ao tipo `MessageTemplate`
- Nos hooks de sync e submit, passar `connectionId` ao edge function

**4. `src/pages/TemplatesPage.tsx`**
- Adicionar filtro por conexão (número) na listagem
- Exibir o número/label na coluna da tabela

**5. `src/components/conversas/TemplatePickerDialog.tsx`**
- Filtrar templates aprovados pelo `connection_id` da conexão selecionada (além de empresa)
- Quando o usuário seleciona uma conexão, mostrar apenas templates daquele número

**6. `supabase/functions/whatsapp-template-manager/index.ts`**
- Aceitar `connectionId` como parâmetro (além de `empresa`)
- Resolver credenciais Meta pela conexão específica em vez de pela empresa
- No sync (PATCH), vincular os templates importados ao `connection_id` correto
- No batch-submit, filtrar por `connection_id`

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Adicionar `connection_id` à `message_templates` |
| `src/hooks/useTemplates.ts` | Tipo + filtro por connectionId |
| `src/components/templates/TemplateFormDialog.tsx` | ConnectionPicker no form |
| `src/pages/TemplatesPage.tsx` | Filtro e coluna de número |
| `src/components/conversas/TemplatePickerDialog.tsx` | Filtrar templates pela conexão selecionada |
| `supabase/functions/whatsapp-template-manager/index.ts` | Resolver credenciais por conexão |

