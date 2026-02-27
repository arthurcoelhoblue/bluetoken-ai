

## Plano: Template obrigatório + Aprovação do gestor para ações em massa

### 1. Migração: adicionar campos de aprovação na tabela `mass_action_jobs`

Adicionar colunas:
- `needs_approval BOOLEAN DEFAULT false` — indica se precisa de aprovação
- `approved_by UUID REFERENCES profiles(id)` — quem aprovou
- `approved_at TIMESTAMPTZ` — quando aprovou
- `rejected_by UUID REFERENCES profiles(id)` — quem rejeitou (opcional)
- `rejected_at TIMESTAMPTZ`
- `rejection_reason TEXT`

Adicionar novo status `AGUARDANDO_APROVACAO` ao fluxo (campo `status` é TEXT, não precisa de enum migration).

### 2. Refatorar dialog de configuração — template obrigatório

No `AmeliaMassActionPage.tsx`, substituir o dialog atual (que tem tabs Cadência/Ad-hoc com Textarea livre) por:

- **Remover** a aba "Campanha Ad-hoc" com textarea livre
- **Substituir** por um seletor de template (similar ao `TemplatePickerDialog`) que busca templates ativos da empresa na tabela `message_templates`
- O campo `template_id` e `template_variables` já existem na tabela — serão preenchidos ao criar o job
- Manter o seletor de canal (WhatsApp/Email) e filtrar templates pelo canal selecionado
- A instrução livre (`instrucao`) passa a ser opcional, como complemento ao template selecionado

### 3. Lógica de aprovação no frontend

No `handleCreate`:
- Verificar se o usuário é ADMIN ou tem role de gestor (via `hasRole('ADMIN')` ou checando se o usuário é gestor de alguém)
- Se **não** for admin/gestor: criar job com `status: 'AGUARDANDO_APROVACAO'` e `needs_approval: true`
- Se **for** admin/gestor: fluxo normal (PENDING → gerar mensagens)

### 4. Notificação para o gestor

Ao criar um job com `needs_approval: true`:
- Buscar `gestor_id` do perfil do usuário que criou (`profiles.gestor_id`)
- Inserir notificação na tabela `notifications` para o gestor, com link para `/amelia/mass-action`
- Tipo: `'APROVACAO'`, referencia_tipo: `'MASS_ACTION'`, referencia_id: job.id

### 5. Painel de aprovação no gestor

Na mesma página `AmeliaMassActionPage`:
- Adicionar uma seção "Pendências de Aprovação" visível apenas para admins/gestores
- Listar jobs com status `AGUARDANDO_APROVACAO` onde o `started_by` é subordinado do gestor logado (via `profiles.gestor_id = auth.uid()`)
- Botões: **Aprovar** (muda status para PENDING e dispara geração) e **Rejeitar** (muda status para REJECTED com motivo)

### 6. Hooks novos em `useProjections.ts`

- `usePendingApprovalJobs(gestorId)`: busca jobs AGUARDANDO_APROVACAO de subordinados
- `useApproveJob()`: mutation que atualiza status → PENDING, preenche approved_by/approved_at, e dispara geração
- `useRejectJob()`: mutation que atualiza status → FAILED, preenche rejected_by/rejected_at/rejection_reason

### 7. Edge function: validar aprovação antes de executar

No `amelia-mass-action/index.ts`, no branch EXECUTE, verificar se `needs_approval && !approved_by` → rejeitar com erro.

### Arquivos impactados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Adicionar colunas approved_by, approved_at, etc |
| `src/pages/AmeliaMassActionPage.tsx` | Template picker, seção aprovações pendentes |
| `src/hooks/useProjections.ts` | Hooks de aprovação/rejeição |
| `src/types/projection.ts` | Novos campos no tipo MassActionJob |
| `supabase/functions/amelia-mass-action/index.ts` | Validar aprovação |

