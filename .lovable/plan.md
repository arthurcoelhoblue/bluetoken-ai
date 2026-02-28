

# Fluxo inteligente de templates nas ações em massa

## Entendimento

O fluxo atual gera mensagens de texto livre com IA, ignorando a obrigatoriedade de templates aprovados no WhatsApp. O novo fluxo deve ser:

1. **Padrão**: A IA usa o template selecionado pelo usuário (já aprovado na Meta), personalizando com variáveis do deal/contato
2. **Sugestão alternativa**: Se a IA, ao analisar o perfil do cliente, sugerir uma abordagem diferente que não se encaixa em nenhum template aprovado:
   - Amélia cria um novo template local automaticamente
   - Submete à Meta para aprovação
   - As mensagens desses deals ficam em status `AGUARDANDO_TEMPLATE`
   - Quando o template for aprovado (via sincronização), as mensagens podem ser disparadas

## Alterações necessárias

### 1. Novo status no tipo `MassActionJobStatus`
**`src/types/projection.ts`**
- Adicionar `'AGUARDANDO_TEMPLATE'` à union type `MassActionJobStatus`

**`src/pages/AmeliaMassActionPage.tsx`**
- Adicionar label e variante para o novo status no `statusLabel` e `statusVariant`

### 2. Expandir `MassActionMessagePreview` 
**`src/types/projection.ts`**
- Adicionar campo opcional `template_status?: 'APPROVED' | 'PENDING_META' | null` para indicar se a mensagem usa template aprovado ou está aguardando
- Adicionar `suggested_template_id?: string | null` para rastrear o template criado pela IA

### 3. Refatorar a branch GENERATE do edge function
**`supabase/functions/amelia-mass-action/index.ts`**

Lógica atual: IA gera texto livre para cada deal.

Nova lógica:
1. Buscar o template selecionado pelo usuário (`job.template_id`)
2. Para cada deal, pedir à IA para personalizar o template com dados do contato (preencher variáveis `{{nome}}`, `{{empresa}}`, etc.)
3. Se a IA recomendar uma abordagem completamente diferente:
   - Verificar se já existe um template aprovado com conteúdo similar
   - Se não existe: criar template local via `message_templates`, submeter à Meta via `whatsapp-template-manager`
   - Marcar a mensagem no preview com `template_status: 'PENDING_META'`
4. Mensagens com template aprovado ficam `template_status: 'APPROVED'`
5. Se houver mensagens pendentes, o job vai para status `AGUARDANDO_TEMPLATE` em vez de `PREVIEW`

### 4. Refatorar a branch EXECUTE
**`supabase/functions/amelia-mass-action/index.ts`**

- Na execução, só enviar mensagens cujo `template_status === 'APPROVED'`
- Mensagens com `template_status === 'PENDING_META'` são ignoradas (ficam para envio posterior)
- Se restam mensagens pendentes, o job fica em `PARTIAL` (não `DONE`)

### 5. Nova action: "Retry pendentes"
**`supabase/functions/amelia-mass-action/index.ts`**

- Nova branch `action === 'retry_pending'`:
  - Re-verificar `meta_status` dos templates criados pela IA
  - Se agora estão `APPROVED`, atualizar `template_status` das mensagens e enviá-las
  - Se ainda pendentes, manter em espera

### 6. UI: Indicação visual de mensagens aguardando template
**`src/pages/AmeliaMassActionPage.tsx`**

- No preview, mensagens com `template_status: 'PENDING_META'` exibem badge `⏳ Aguardando Meta`
- Botão "Verificar templates pendentes" que chama a action `retry_pending`
- Separar visualmente: mensagens prontas vs aguardando aprovação
- Botão de enviar só conta mensagens com template aprovado

### 7. Migração de banco
- Adicionar `'AGUARDANDO_TEMPLATE'` ao enum de status se existir como enum no banco (ou apenas tratar como texto se já é `text`)
- Verificar se `messages_preview` (JSONB) precisa de ajuste de schema

## Resultado esperado
- Usuário seleciona deals + template aprovado → IA personaliza usando o template
- Se IA sugere abordagem diferente → cria template, submete à Meta, mensagem fica em standby
- Usuário pode enviar as mensagens já aprovadas imediatamente
- Volta depois para enviar as que estavam aguardando aprovação da Meta

