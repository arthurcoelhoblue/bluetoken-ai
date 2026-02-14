

# Plano de Correcao — Auditoria Tecnica BlueCRM

Baseado na auditoria do PO, organizamos as correcoes em **6 etapas sequenciais**, cada uma testavel antes de avancar. A observacao sobre Tokeniza Offers (nao viram Deal, mas geram tags para deals) sera incorporada na Etapa 5.

---

## Etapa 1 — Fundacoes Criticas (nao quebra nada, estabiliza tudo)

### 1.1 Error Boundaries
- Criar componente `ErrorBoundary` generico em `src/components/ErrorBoundary.tsx`
- Envolver `App.tsx` com ErrorBoundary global (tela de fallback amigavel com botao "Recarregar")
- Envolver secoes criticas (pipeline, conversas, workbench) com ErrorBoundaries locais no router

### 1.2 QueryClient com defaults
- Configurar `new QueryClient()` em `App.tsx` com:
  - `retry: 2`
  - `staleTime: 30_000` (30s)
  - `gcTime: 5 * 60_000` (5min)
  - `onError` global com `toast.error`
- Isso ja resolve o item 5.1 (staleTime inconsistente) como efeito colateral

### 1.3 Code Splitting (React.lazy + Suspense)
- Converter todos os imports de paginas em `App.tsx` para `React.lazy()`
- Envolver `<Routes>` com `<Suspense fallback={<LoadingSpinner />}>`
- Criar componente `LoadingSpinner` simples e reutilizavel

### Teste da Etapa 1
- Verificar que a app carrega normalmente
- Forcar um erro em um componente e confirmar que o ErrorBoundary captura sem tela branca
- Verificar no DevTools que o bundle foi dividido (chunks separados)

---

## Etapa 2 — GlobalSearch + Empresa Casing

### 2.1 Fix GlobalSearch
- Filtrar queries por `empresa` usando `activeCompany` (contacts.empresa, deals via pipeline join, organizations.empresa)
- Ao clicar em contato: abrir `ContactDetailSheet` (ou navegar para `/contatos?open=ID`)
- Ao clicar em deal: navegar para `/pipeline?deal=ID`
- Ao clicar em organizacao: abrir `OrgDetailSheet` (ou navegar para `/organizacoes?open=ID`)

### 2.2 CompanyContext para UPPERCASE
- Mudar `ActiveCompany` de `'blue' | 'tokeniza' | 'all'` para `'BLUE' | 'TOKENIZA' | 'ALL'`
- Atualizar `LABELS`, `STORAGE_KEY` logic, `CompanySwitcher`
- Remover todos os `.toUpperCase()` espalhados em ~30 arquivos (substituicao mecanica)
- Ajustar comparacoes `=== 'all'` para `=== 'ALL'`

### Teste da Etapa 2
- Buscar um contato pelo nome e confirmar que clica e abre o item correto
- Trocar empresa no switcher e confirmar que busca so retorna itens da empresa ativa
- Verificar que pipeline, contatos, organizacoes continuam filtrando corretamente apos mudanca de casing

---

## Etapa 3 — SDR IA (economia) + Consolidacao de Tipos

### 3.1 Fix SDR-IA: skip AI call em modo MANUAL
- No `sdr-ia-interpret/index.ts`, mover o check de `modoAtendimento === 'MANUAL'` para **antes** de `interpretWithAI()`
- Em modo MANUAL: registrar mensagem com intent `MANUAL_MODE` e confidence 1.0 diretamente, sem chamar a API de IA
- Manter o log no banco para historico

### 3.2 Consolidar EmpresaTipo
- Criar `src/types/enums.ts` como single source of truth para `EmpresaTipo`, `CanalTipo` e outros enums compartilhados
- Reexportar de `enums.ts` nos arquivos existentes (`cadence.ts`, `sgt.ts`, `patch13.ts`) para nao quebrar imports
- Nas edge functions: como nao compartilham imports com o frontend, manter a definicao local mas documentar que a fonte de verdade e `types/enums.ts`

### 3.3 Renomear arquivos de tipo temporarios
- `types/patch12.ts` → `types/projection.ts` (atualizar imports)
- `types/patch13.ts` → `types/telephony.ts` (atualizar imports)
- Consolidar `types/cadence.ts` + `types/cadencias.ts` em um unico `types/cadence.ts`
- Consolidar `types/deal.ts` + `types/dealDetail.ts` em `types/deal.ts`

### Teste da Etapa 3
- Enviar mensagem para lead em modo MANUAL e verificar nos logs da edge function que a chamada IA NAO acontece
- Verificar que imports em todos os hooks/components continuam resolvendo corretamente
- Build sem erros

---

## Etapa 4 — Limpeza e Qualidade

### 4.1 Remover console.logs de producao
- Substituir `console.log` por nada (remover) nos hooks e componentes do frontend
- Manter `console.error` em catch blocks (uteis para debug)
- Nos hooks, os `console.error` que fazem `throw` logo depois sao redundantes — remover

### 4.2 Remover componentes orfaos
- `ClickToCallButton.tsx` — verificar se realmente nao e usado, remover se orfao
- `DashboardContent.tsx` — idem
- UI primitivos nao usados (`drawer.tsx`, `pagination.tsx`, `breadcrumb.tsx`, etc.) — manter (fazem parte do kit shadcn, podem ser usados no futuro)

### 4.3 Fix RenovacaoPage (busca por nome de pipeline)
- Adicionar campo `tipo` ou `is_renovacao` no pipeline, ou usar um campo existente para identificar o pipeline de renovacao sem depender de `nome.includes('renova')`
- Alternativa minima: buscar por `slug` ou `codigo` em vez de nome livre

### 4.4 Fix IntegracoesPage (shell vazio)
- A rota `/integracoes` ja redireciona para `/admin/settings` — remover o arquivo `IntegracoesPage.tsx` e o import em `App.tsx` (ja desnecessario)

### Teste da Etapa 4
- Verificar que o console do browser em producao esta limpo
- Navegar para `/renovacao` e confirmar que funciona
- Verificar que `/integracoes` redireciona corretamente

---

## Etapa 5 — Tokeniza Offers como Tags de Deal (sua observacao)

### 5.1 Sistema de Tags para Deals
- Criar tabela `deal_tags` (ou usar o sistema de custom fields existente com um campo tipo "select" populado pelas ofertas ativas)
- Alternativa mais simples: adicionar coluna `tags TEXT[]` na tabela `deals` (array de strings)

### 5.2 Conectar Tokeniza Offers como fonte de tags
- Na tela de Pipeline/DealDetail, ao editar um deal, mostrar selector de tags onde as opcoes incluem ofertas ativas da Tokeniza (nome da oferta como tag)
- O vendedor pode marcar quais ofertas sao relevantes para aquele deal
- Nao cria deal automaticamente — apenas associa a tag

### 5.3 Filtro por tag no Pipeline
- Adicionar filtro de tags no `PipelineFilters` (multi-select)
- Filtrar deals que contem a tag selecionada

### Teste da Etapa 5
- Criar um deal, adicionar tag de oferta Tokeniza
- Filtrar pipeline pela tag e confirmar que aparece apenas o deal marcado

---

## Etapa 6 — Copilot + Enriquecimento

### 6.1 Copilot: enriquecer com custom fields e organizations
- Em `enrichDealContext()`: buscar `custom_field_values` do deal e do contato
- Em `enrichLeadContext()`: buscar `organizations` vinculada ao contato
- Incluir esses dados no bloco de contexto injetado no prompt

### 6.2 Copilot: considerar upgrade de modelo
- O copilot usa `google/gemini-3-flash-preview` via Lovable AI Gateway
- Opcao 1 (sem custo extra de API key): trocar para `google/gemini-2.5-pro` ou `openai/gpt-5-mini` no mesmo gateway — modelos mais capazes
- Opcao 2: manter Lovable AI Gateway mas com modelo superior
- **Nota**: a migracao para Anthropic API diretamente exigiria uma API key separada. Como o Lovable AI Gateway ja oferece modelos potentes (gpt-5, gemini-2.5-pro), o upgrade dentro do gateway e preferivel

### Teste da Etapa 6
- Abrir Copilot no contexto de um deal com campos customizados preenchidos
- Perguntar sobre o deal e verificar que a resposta menciona os campos custom
- Comparar qualidade da resposta com modelo anterior

---

## Itens NAO incluidos neste plano (decisao consciente)

Os seguintes itens da auditoria sao relevantes mas envolvem escopo grande ou decisoes de produto que precisam de discussao separada:

| Item | Motivo |
|------|--------|
| Realtime subscriptions (3.1) | Requer decisao sobre quais entidades precisam de realtime e impacto em custos |
| Paginacao real (3.5) | Requer mudanca de UX significativa (infinite scroll vs paginacao) |
| Testes (3.6) | Trabalho continuo, nao e "correcao" pontual |
| Validacao com Zod (4.4) | Bom mas extenso — pode ser feito formulario a formulario |
| Reducao de `as any` (3.2) | Requer regeneracao de types.ts e ajuste progressivo |
| Sprint 2 IA-First (Next Best Action, auto-creation, etc.) | Features novas, nao correcoes |
| Leads vs Contacts unificacao (8.1) | Decisao arquitetural profunda |
| Gamificacao com consequencia (8.2) | Feature nova |
| Cadencias SDR vs CRM unificacao (8.3) | Refactor grande |

Esses itens podem ser planejados em etapas futuras apos a estabilizacao.

---

## Resumo de Sequenciamento

```text
Etapa 1 (ErrorBoundary + QueryClient + CodeSplitting)
  |
  v
Etapa 2 (GlobalSearch + Empresa UPPERCASE)
  |
  v
Etapa 3 (SDR-IA economia + Tipos consolidados)
  |
  v
Etapa 4 (Limpeza: console.logs, orfaos, RenovacaoPage, IntegracoesPage)
  |
  v
Etapa 5 (Tokeniza Offers → Tags de Deal + filtro)
  |
  v
Etapa 6 (Copilot enriquecido + upgrade modelo)
```

Cada etapa sera implementada, testada e validada antes de avancar para a proxima.

