

## Form de Captura — Estrutura Completa

### Visao Geral

Criar um modulo "Form de Captura" dentro do grupo Automacao na sidebar, com uma pagina de gestao (datatable) e um builder de formularios estilo Typeform. Os formularios serao publicos (sem autenticacao) e os leads capturados serao inseridos no pipeline automaticamente.

---

### 1. Banco de Dados

Duas tabelas novas:

**`capture_forms`** — Metadados dos formularios
- `id` (uuid, PK)
- `empresa` (text, NOT NULL) — BLUE ou TOKENIZA
- `nome` (text, NOT NULL)
- `slug` (text, UNIQUE, NOT NULL) — identificador na URL publica
- `descricao` (text)
- `pipeline_id` (uuid, FK pipelines.id) — pipeline destino dos leads
- `stage_id` (uuid, FK pipeline_stages.id) — estagio inicial
- `fields` (jsonb, NOT NULL, default '[]') — definicao dos campos/steps do form
- `settings` (jsonb, default '{}') — cores, logo, mensagem de conclusao
- `status` (text, default 'DRAFT') — DRAFT, PUBLISHED, ARCHIVED
- `created_by` (uuid, FK profiles.id)
- `created_at` / `updated_at` (timestamptz)

**`capture_form_submissions`** — Respostas recebidas
- `id` (uuid, PK)
- `form_id` (uuid, FK capture_forms.id)
- `empresa` (text)
- `answers` (jsonb) — respostas do usuario
- `metadata` (jsonb) — IP, user-agent, UTM params
- `rating_score` (integer, nullable) — reservado para o sistema de rating futuro
- `contact_id` (uuid, FK contatos.id, nullable) — contato criado/vinculado
- `deal_id` (uuid, FK deals.id, nullable) — deal criado no pipeline
- `created_at` (timestamptz)

RLS: `capture_forms` isolado por empresa via `get_user_empresa`. `capture_form_submissions` idem. A edge function de submissao usara `service_role`.

---

### 2. Edge Function — `capture-form-submit`

Endpoint publico (sem auth) que:
1. Recebe `{ slug, answers, metadata }`
2. Busca o form pelo slug
3. Valida campos obrigatorios
4. Cria ou vincula contato na tabela `contatos`
5. Cria deal no pipeline/stage configurado
6. Insere registro em `capture_form_submissions`
7. Retorna sucesso

---

### 3. Frontend — Paginas e Componentes

**Pagina de Gestao (`/capture-forms`)**
- Wrapper `AppLayout` com `CaptureFormsContent` (padrao do projeto)
- Datatable com colunas: Nome, Status (badge), Respostas (count), Pipeline destino, Criado em, Acoes
- Acoes por linha: Editar nome (inline ou dialog), Visualizar, Editar conteudo, Compartilhar (copiar link publico), Excluir
- Botao "Criar Form de Captura" no topo
- Filtro por status e busca por nome

**Pagina do Builder (`/capture-forms/:id/edit`)**
- Editor visual dos steps do formulario
- Cada step = 1 pergunta (estilo Typeform, tela cheia por pergunta)
- Tipos de campo: texto curto, texto longo, email, telefone, selecao unica, selecao multipla, numero
- Configuracao: pipeline destino, estagio, cores, mensagem de conclusao
- Preview lateral

**Pagina Publica do Form (`/f/:slug`)**
- Rota publica (sem ProtectedRoute, sem AppLayout)
- Renderiza os steps um a um, tela cheia, com transicoes suaves
- Ao finalizar, chama a edge function `capture-form-submit`
- Tela de agradecimento configuravel

**Dialog de Compartilhamento**
- Mostra URL publica copiavel
- Opcao de copiar link

---

### 4. Sidebar e Rotas

- Adicionar item "Form de Captura" no grupo Automacao da sidebar (icone `ClipboardList`)
- Registrar no `screenRegistry.ts` com key `capture_forms`
- Rotas novas no `App.tsx`:
  - `/capture-forms` — listagem (ProtectedRoute, roles ADMIN)
  - `/capture-forms/new` — criar (ProtectedRoute, roles ADMIN)  
  - `/capture-forms/:id/edit` — builder (ProtectedRoute, roles ADMIN)
  - `/f/:slug` — formulario publico (sem ProtectedRoute)

---

### 5. Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar tabelas + RLS |
| `src/pages/CaptureFormsPage.tsx` | Listagem com datatable |
| `src/pages/CaptureFormBuilderPage.tsx` | Builder de campos |
| `src/pages/PublicFormPage.tsx` | Renderizacao publica |
| `src/hooks/useCaptureForms.ts` | CRUD dos formularios |
| `src/types/captureForms.ts` | Tipagens |
| `src/components/capture-forms/FormFieldEditor.tsx` | Editor de campo individual |
| `src/components/capture-forms/PublicFormRenderer.tsx` | Renderizador Typeform-style |
| `src/components/capture-forms/ShareFormDialog.tsx` | Dialog de compartilhamento |
| `supabase/functions/capture-form-submit/index.ts` | Submissao publica |
| `src/components/layout/AppSidebar.tsx` | Adicionar menu |
| `src/config/screenRegistry.ts` | Registrar tela |
| `src/App.tsx` | Adicionar rotas |
| `src/components/layout/TopBar.tsx` | Adicionar titulo da rota |

---

### Secao Tecnica — Estrutura do `fields` (jsonb)

```text
[
  {
    "id": "uuid",
    "type": "short_text" | "long_text" | "email" | "phone" | "single_select" | "multi_select" | "number",
    "label": "Qual seu nome?",
    "required": true,
    "placeholder": "Digite aqui...",
    "options": ["Opcao A", "Opcao B"]  // apenas para select
  }
]
```

### Ordem de Implementacao

1. Migration (tabelas + RLS)
2. Tipos e hook
3. Pagina de listagem + sidebar/rotas
4. Builder de formularios
5. Edge function de submissao
6. Pagina publica do form

