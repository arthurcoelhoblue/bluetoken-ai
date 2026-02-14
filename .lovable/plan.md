

# Fase 3: Cockpit Executivo + Templates CRUD + Envio em Massa

## 8. Cockpit Executivo

Transformar a shell page em um dashboard gerencial que mostra KPIs consolidados em uma unica tela. Usa inteiramente dados que ja existem via hooks `useAnalytics` e `useWorkbench`.

### Layout do Cockpit

```text
+---------------------------------------------+
|  KPIs: Win Rate | Ticket Medio | Pipeline    |
|         Ciclo   | Deals Ativos | SLA Alerts  |
+---------------------------------------------+
|  Funil Resumido (top 5 stages)  | Evolucao   |
|  com barras horizontais         | mini chart  |
+---------------------------------------------+
|  Top 5 Vendedores   |  Motivos de Perda      |
|  (ranking compacto)  |  (top 5 barras)        |
+---------------------------------------------+
|  Canais de Origem    |  Tarefas Atrasadas     |
|  (mini tabela)       |  (SLA alerts count)    |
+---------------------------------------------+
```

### Arquivos

**`src/pages/CockpitPage.tsx`** (reescrever)
- Importar hooks: `useAnalyticsConversion`, `useAnalyticsFunnel`, `useAnalyticsVendedor`, `useAnalyticsMotivosPerda`, `useAnalyticsCanalOrigem`, `useAnalyticsEvolucao`, `useWorkbenchSLAAlerts`
- Usar `usePipelines` para filtro de pipeline (como no AnalyticsPage)
- 6 KPI cards no topo (Total Deals, Win Rate, Valor Ganho, Pipeline Aberto, Ticket Medio, Ciclo Medio)
- Grid 2x2 com resumos compactos de funil, evolucao, vendedores e perdas
- Sem tabs -- tudo visivel numa tela so (diferente do AnalyticsPage que usa tabs)

Nao precisa de novos hooks nem mudancas no banco.

---

## 9. Templates CRUD

A tabela `message_templates` ja existe com 19 registros e RLS configurado (ADMIN pode CRUD, MARKETING/SDR_IA podem ler).

### Colunas existentes
| Campo | Tipo |
|-------|------|
| id | uuid |
| empresa | BLUE/TOKENIZA |
| canal | WHATSAPP/EMAIL |
| codigo | text (unico) |
| nome | text |
| descricao | text (nullable) |
| conteudo | text |
| ativo | boolean |
| assunto_template | text (nullable, para email) |

### Arquivos

**`src/hooks/useTemplates.ts`** (novo)
- `useTemplates(empresa, canal?)` -- lista templates com filtros
- `useCreateTemplate()` -- mutation INSERT
- `useUpdateTemplate()` -- mutation UPDATE
- `useDeleteTemplate()` -- mutation DELETE (ou desativar)

**`src/pages/TemplatesPage.tsx`** (reescrever)
- Filtros: empresa (BLUE/TOKENIZA/Todas) + canal (WHATSAPP/EMAIL/Todos) + ativo/inativo
- Tabela com colunas: Nome, Codigo, Canal, Empresa, Ativo, Acoes
- Botao "Novo Template" abre dialog
- Clicar em um template abre dialog de edicao
- Preview do conteudo com highlight de placeholders (`{{primeiro_nome}}`, etc)

**`src/components/templates/TemplateFormDialog.tsx`** (novo)
- Dialog com form: nome, codigo, empresa, canal, conteudo, assunto (se email), descricao
- Textarea para conteudo com contagem de caracteres
- Toggle ativo/inativo
- Validacao com zod

Nao precisa de migracao no banco -- tabela e RLS ja existem.

---

## 11. Envio em Massa (amelia-mass-action execute)

O frontend ja envia `{ jobId, action: 'execute' }` para a edge function, mas a edge function so trata o fluxo de geracao (sem `action`). Precisamos adicionar o branch de execucao.

### Edge Function: `supabase/functions/amelia-mass-action/index.ts`

Adicionar logica para `action === 'execute'`:

```text
1. Ler body: { jobId, action }
2. Se action === 'execute':
   a. Carregar job (status deve ser PREVIEW)
   b. Filtrar messages_preview onde approved === true
   c. Para cada mensagem aprovada:
      - Buscar dados do deal (contact telefone/email)
      - Se canal === WHATSAPP: chamar whatsapp-send internamente
      - Se canal === EMAIL: chamar email-send internamente
      - Registrar sucesso/erro
   d. Atualizar job: status = DONE, processed = total enviados
3. Se action nao informado: fluxo atual de geracao (sem mudanca)
```

A chamada interna sera feita via `fetch` para as edge functions `whatsapp-send` e `email-send` usando a URL do Supabase + service role key.

### Mudancas

**`supabase/functions/amelia-mass-action/index.ts`**
- Extrair `action` do body junto com `jobId`
- Branch: se `action === 'execute'`, executar envio real
- Se sem action, manter fluxo de geracao existente
- Para cada mensagem aprovada, chamar a edge function correspondente
- Atualizar status do job para DONE ou FAILED ao final

---

## Resumo de arquivos

| Arquivo | Acao |
|---------|------|
| `src/pages/CockpitPage.tsx` | Reescrever com dashboard executivo |
| `src/hooks/useTemplates.ts` | Criar hook CRUD |
| `src/pages/TemplatesPage.tsx` | Reescrever com CRUD funcional |
| `src/components/templates/TemplateFormDialog.tsx` | Criar dialog de form |
| `supabase/functions/amelia-mass-action/index.ts` | Adicionar branch execute |

Nenhuma migracao de banco necessaria. Nenhuma nova dependencia.

