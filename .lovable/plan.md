

# Blue CRM -- Patch 0: Reorganizacao UX + Estrutura Base

## Resumo

Transformar o Bluetoken AI (SDR IA) em **Blue CRM** reorganizando a navegacao, visual e estrutura de paginas. Tudo que funciona hoje continua funcionando -- nenhuma edge function, banco de dados, hook ou componente existente sera alterado. O patch e 100% frontend.

## O que muda

1. **Nova sidebar** com 4 grupos: Principal, Comercial, Automacao, Configuracao
2. **TopBar** com titulo da pagina, busca (visual), notificacoes, toggle dark/light e avatar
3. **Company Switcher** na sidebar para alternar entre Blue Consult, Tokeniza e Todas
4. **Dark/Light mode** com ThemeProvider
5. **9 novas paginas shell** (placeholder) para funcionalidades futuras
6. **Landing page** atualizada com branding "Blue CRM"
7. **Novas rotas** no App.tsx mantendo todas as existentes

## O que NAO muda

- Nenhuma edge function (sdr-ia-interpret, bluechat-inbound, cadence-runner, etc.)
- Nenhuma tabela do banco de dados (zero migrations)
- AuthContext, ProtectedRoute, RBAC
- Todas as paginas existentes: LeadDetail, CadencesList, Settings, AIBenchmark, etc.
- Todos os hooks e componentes existentes

## Sequencia de implementacao

### Fase 1 -- Novos contextos (sem impacto visual)

| # | Arquivo | Acao |
|---|---------|------|
| 1 | `src/contexts/ThemeContext.tsx` | Criar -- gerencia dark/light mode com localStorage |
| 2 | `src/contexts/CompanyContext.tsx` | Criar -- gerencia empresa ativa (blue, tokeniza, all) |

### Fase 2 -- Novos componentes de layout

| # | Arquivo | Acao |
|---|---------|------|
| 3 | `src/components/layout/CompanySwitcher.tsx` | Criar -- dropdown de selecao de empresa na sidebar |
| 4 | `src/components/layout/TopBar.tsx` | Criar -- barra superior com titulo, busca, notificacoes, theme toggle, avatar |
| 5 | `src/components/layout/PageShell.tsx` | Criar -- componente reutilizavel para paginas placeholder |

### Fase 3 -- Paginas shell (placeholders para patches futuros)

| # | Arquivo | Descricao |
|---|---------|-----------|
| 6 | `src/pages/PipelinePage.tsx` | Shell -- Pipeline Kanban (Patch 1) |
| 7 | `src/pages/ContatosPage.tsx` | Shell -- Contatos unificados (Patch 2) |
| 8 | `src/pages/ConversasPage.tsx` | Shell -- Conversas integradas (Patch 3) |
| 9 | `src/pages/MetasPage.tsx` | Shell -- Metas e Comissoes (Patch 5) |
| 10 | `src/pages/RenovacaoPage.tsx` | Shell -- Renovacao e Churn (Patch 8) |
| 11 | `src/pages/CockpitPage.tsx` | Shell -- Cockpit Executivo (Patch 7) |
| 12 | `src/pages/AmeliaPage.tsx` | Shell -- Amelia IA Central (adaptar) |
| 13 | `src/pages/TemplatesPage.tsx` | Shell -- Templates de mensagem |
| 14 | `src/pages/IntegracoesPage.tsx` | Shell -- Integracoes |

### Fase 4 -- Reescrever layout (momento critico)

| # | Arquivo | Acao |
|---|---------|------|
| 15 | `src/components/layout/AppSidebar.tsx` | Reescrever -- nova estrutura de 4 grupos com Company Switcher, branding Blue CRM, badges e live dots |
| 16 | `src/components/layout/AppLayout.tsx` | Reescrever -- integrar ThemeProvider, CompanyProvider e TopBar |

### Fase 5 -- Rotas e pagina inicial

| # | Arquivo | Acao |
|---|---------|------|
| 17 | `src/App.tsx` | Atualizar -- adicionar 9 novas rotas mantendo todas as existentes |
| 18 | `src/pages/Index.tsx` | Atualizar -- landing page com branding Blue CRM, dashboard permanece igual para usuarios autenticados |

## Detalhes tecnicos

### ThemeContext
- Armazena preferencia em `localStorage` com chave `bluecrm-theme`
- Default: `dark`
- Aplica classe `dark`/`light` no `document.documentElement`
- Expoe: `theme`, `toggleTheme`, `setTheme`

### CompanyContext
- Armazena empresa ativa em `localStorage` com chave `bluecrm-company`
- Valores: `blue`, `tokeniza`, `all`
- Default: `blue`
- Expoe: `activeCompany`, `setActiveCompany`, `companyLabel`

### TopBar
- Titulo dinamico baseado na rota atual (mapa rota -> titulo)
- Busca visual (sem funcionalidade neste patch -- apenas UI)
- Notificacoes (icone com dot vermelho -- sem funcionalidade neste patch)
- Toggle dark/light usando ThemeContext
- Avatar do usuario com fallback para iniciais

### AppSidebar -- Nova estrutura de navegacao

```text
PRINCIPAL
  Meu Dia          /               ALL
  Pipeline          /pipeline       ALL
  Contatos          /contatos       ALL
  Conversas         /conversas      ALL

COMERCIAL
  Metas & Comissoes /metas          ALL
  Renovacao         /renovacao      ALL
  Cockpit           /cockpit        ADMIN, CLOSER

AUTOMACAO
  Amelia IA         /amelia         ADMIN        (live dot)
  Cadencias         /cadences       ADMIN, MKT
  Leads em Cadencia /cadences/runs  ADMIN, CLOSER, MKT
  Prox. Acoes       /cadences/next  ADMIN, CLOSER
  Templates         /templates      ADMIN, MKT

CONFIGURACAO
  Knowledge Base    /admin/produtos ADMIN
  Integracoes       /integracoes    ADMIN
  Benchmark IA      /admin/ai-bench ADMIN
  Monitor SGT       /monitor/sgt    ADMIN, AUDITOR
  Leads Quentes     /admin/leads-q  ADMIN, CLOSER
  Configuracoes     /admin/settings ADMIN
```

### PageShell (componente reutilizavel)
- Icone centralizado com fundo `primary/10`
- Titulo e descricao do que vira no patch futuro
- Badge informativo com numero do patch

### Estrategia anti-quebra
- Todas as rotas existentes (`/leads`, `/cadences/*`, `/admin/*`, `/monitor/*`, `/tokeniza/*`, `/me`, `/auth`) sao mantidas intactas
- Paginas existentes nao sao modificadas internamente
- AppLayout mantem a mesma interface `{ children, requireAuth }` -- nenhuma pagina existente precisa ser alterada
- Edge functions e banco de dados intocados

## Roadmap futuro (para contexto, NAO implementado agora)

| Patch | Nome | Escopo |
|-------|------|--------|
| 1 | Pipeline Kanban | Tabelas deals/stages/pipelines, drag-drop, CRUD |
| 2 | Contatos Unificados | Merge pessoas + leads, busca, timeline |
| 3 | Conversas Integradas | Chat WhatsApp/Email dentro do CRM |
| 4 | Meu Dia (Workbench) | KPIs vendedor, SLA, acoes, comissao |
| 5 | Metas & Comissoes | Metas por vendedor, projecao, simulador |
| 6 | Amelia Acao em Massa | Selecionar leads e acionar Amelia |
| 7 | Cockpit & Dashboards | Cockpit 30s, funil, export |
| 8 | Renovacao & Churn | Pipeline renovacao, alertas, tracking |
| 9 | Eliminar Pipedrive | Migracao final, CRM como source of truth |

