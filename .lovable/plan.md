

## Patch 6: Meu Dia — Dashboard do Vendedor

### Resumo

Este patch cria a pagina "Meu Dia" (/meu-dia), o cockpit pessoal do vendedor com KPIs, alertas de SLA, tarefas pendentes, resumo de pipelines e deals recentes. Tudo filtrado por empresa ativa e usuario logado.

---

### Gaps identificados no banco de dados

1. **Views SQL nao existem** — `workbench_tarefas`, `workbench_sla_alerts`, `workbench_pipeline_summary` precisam ser criadas
2. **Coluna `moved_at` nao existe** — O PDF referencia `dsh.moved_at` na view `workbench_sla_alerts`, mas a tabela `deal_stage_history` usa `created_at`. A view sera adaptada para usar `created_at`
3. **Coluna `fechado_em` verificar** — A view SLA filtra por `d.fechado_em IS NULL`. Precisa confirmar que esta coluna existe em `deals`

### Gaps identificados no codigo

1. **Sidebar ja tem "Meu Dia" apontando para `/`** — O item existe mas aponta para a rota raiz que renderiza `DashboardContent`. Sera redirecionado para `/meu-dia`
2. **`Index.tsx` renderiza `DashboardContent`** — Sera alterado para redirecionar para `/meu-dia` quando autenticado
3. **Dependencia do Patch 5** — Usa `DealDetailSheet` e `useToggleTaskActivity` do hook `useDealDetail`
4. **Locale `date-fns/locale/pt-BR`** — O PDF usa formatacao em portugues com `ptBR` locale

---

### Ordem de implementacao

#### Fase 1: Migration SQL

Uma unica migration que cria 3 views (todas com `SECURITY INVOKER`):

- **`workbench_tarefas`** — Tarefas pendentes (tipo TAREFA) dos deals, com JOINs para deal, stage, contact, pipeline
- **`workbench_sla_alerts`** — Deals abertos em stages com SLA definido, com calculo de `minutos_no_stage`, `sla_estourado` (boolean), `sla_percentual` (0-100+). Usa `created_at` em vez de `moved_at` da `deal_stage_history`
- **`workbench_pipeline_summary`** — Aggregates por pipeline/owner/empresa: total deals, abertos/ganhos/perdidos, valores

#### Fase 2: Types

Criar `src/types/workbench.ts`:
- `WorkbenchTarefa` — interface com campos da view workbench_tarefas
- `WorkbenchSLAAlert` — interface com deal_id, sla_percentual, sla_estourado, minutos_no_stage, etc.
- `WorkbenchPipelineSummary` — interface com pipeline_id, deals_abertos/ganhos/perdidos, valores

#### Fase 3: Hooks

Criar `src/hooks/useWorkbench.ts`:
- `useWorkbenchTarefas()` — tarefas pendentes filtradas por owner + empresa, ordenadas por prazo
- `useWorkbenchSLAAlerts()` — alertas SLA ordenados por criticidade, refresh a cada 60s
- `useWorkbenchPipelineSummary()` — resumo por pipeline do vendedor
- `useWorkbenchRecentDeals()` — ultimos 7 dias via query direta em `deals` com JOIN `pipeline_stages`

#### Fase 4: Componente

Criar `src/pages/WorkbenchPage.tsx`:
- **Greeting** contextual: "Bom dia/tarde/noite, [nome]" + data formatada em PT-BR + contadores (tarefas hoje, SLA estourados)
- **4 KPI Cards**: Pipeline aberto (R$), Total ganho (R$), Deals abertos (qtd), SLA estourados (qtd)
- **SLA Alerts**: Cards vermelhos/amarelos com barra de progresso visual, clicavel abre DealDetailSheet
- **Tarefas pendentes**: Lista com checkbox para concluir, indicacao atrasada/hoje/amanha, clicavel abre DealDetailSheet
- **Meus Pipelines**: Resumo por pipeline com deals abertos/ganhos/perdidos + valores
- **Deals recentes**: Ultimos 7 dias com stage colorido, valor, icone ganho/perdido
- **Copilot**: Botao no header para perguntas gerais (via CopilotPanel existente)

#### Fase 5: Integracao

- **App.tsx**: Adicionar rota `/meu-dia` com `ProtectedRoute` (roles ADMIN, CLOSER). Redirecionar `/` para `/meu-dia` quando autenticado
- **AppSidebar.tsx**: Atualizar item "Meu Dia" para apontar para `/meu-dia` em vez de `/`
- **Index.tsx**: Quando autenticado, redirecionar para `/meu-dia` em vez de renderizar DashboardContent

---

### Adaptacoes vs PDF

| Item | PDF | Implementacao real |
|------|-----|--------------------|
| `deal_stage_history.moved_at` | Assume `moved_at` | Usar `created_at` existente |
| Rota `/` | Redirect para `/meu-dia` | Index.tsx redireciona quando autenticado |
| Sidebar "Meu Dia" | Novo item | Item ja existe, atualizar URL para `/meu-dia` |
| `date-fns` locale | Assume `ptBR` importado | Importar de `date-fns/locale/pt-BR` |
| Deals recentes JOIN | `d.contacts?.nome` | Usar `contacts!inner(nome)` via Supabase query |

---

### Checklist de validacao

1. Migration SQL rodada — 3 views existem
2. Verificar: SELECT * FROM workbench_tarefas LIMIT 5
3. Verificar: SELECT * FROM workbench_sla_alerts LIMIT 5
4. Verificar: SELECT * FROM workbench_pipeline_summary LIMIT 5
5. types/workbench.ts criado
6. hooks/useWorkbench.ts criado com 4 hooks
7. pages/WorkbenchPage.tsx criado
8. Rota /meu-dia configurada no App.tsx
9. Sidebar "Meu Dia" aponta para /meu-dia
10. Testar: abrir /meu-dia, ver greeting, KPIs, SLA alerts, tarefas
11. Testar: checkbox tarefa — marca como concluida
12. Testar: clicar deal na lista — DealDetailSheet abre
13. Testar: trocar empresa no company switcher — dados atualizam

