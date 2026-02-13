

## Patch 5: Deal Detail — Pagina Completa

### Resumo

Este patch entrega a experiencia completa do Deal com pagina de detalhe (DealDetailSheet), timeline de atividades, barra de progresso visual, acoes de Ganhar/Perder/Reabrir, criacao de notas/tarefas/ligacoes, custom fields EAV, scores IA, e integracao com Copilot.

---

### Gaps identificados no banco de dados

1. **Tabela `deal_activities` nao existe** — Precisa ser criada com 14 tipos de atividade
2. **View `deals_full_detail` nao existe** — JOIN completo de deals com contacts, organizations, stages, pipelines, profiles + tempo no stage
3. **Trigger `trg_deal_activity_log` nao existe** — Auto-log de STAGE_CHANGE, VALOR_CHANGE, GANHO, PERDA
4. **Colunas faltando em `deals`** — O PDF assume `canal_origem`, `data_previsao_fechamento`, `notas` e `metadata`, que nao existem na tabela atual
5. **Coluna `moved_at` vs `created_at`** — O PDF referencia `moved_at` na `deal_stage_history`, mas a coluna real e `created_at`. A view sera adaptada para usar `created_at`

### Gaps identificados no codigo

1. **DealCard nao tem onClick** — Nao existe callback para abrir o detail sheet ao clicar
2. **KanbanBoard/KanbanColumn nao propagam click** — Sem suporte a `onDealClick`
3. **CopilotPanel usa `context` object** — O PDF passa props separadas (`contextType`, `contextId`), mas o componente real usa `context: { type, id, empresa, ... }`. Sera adaptado
4. **`DealFormData` incompleto** — Faltam `canal_origem`, `notas`, `data_previsao_fechamento`
5. **CreateDealDialog existente** em `pipeline/` sera substituido pelo novo `deals/DealCreateDialog`

---

### Ordem de implementacao

#### Fase 1: Migration SQL

Uma unica migration que:

- Adiciona colunas em `deals`: `canal_origem TEXT`, `data_previsao_fechamento TIMESTAMPTZ`, `notas TEXT`, `metadata JSONB DEFAULT '{}'`
- Cria tabela `deal_activities` com RLS (authenticated read, ADMIN/CLOSER manage)
- Cria indices de performance (`idx_deal_activities_deal`, `idx_deal_activities_tipo`, `idx_deal_activities_tarefa`)
- Cria trigger `trg_deal_activity_log` (SECURITY DEFINER) que auto-registra STAGE_CHANGE, VALOR_CHANGE, GANHO/PERDA
- Cria view `deals_full_detail` (SECURITY INVOKER) com todos os JOINs + campo calculado `minutos_no_stage` usando `created_at` da `deal_stage_history`

Nota sobre a policy "Service can manage": o PDF inclui uma policy sem role restriction (`USING (true)`). Esta e para o service_role usado por triggers. Sera incluida conforme o PDF.

#### Fase 2: Types

Criar `src/types/dealDetail.ts`:
- `DealActivityType` — union dos 14 tipos
- `DealActivity` — interface com campos da tabela + `user_nome` joined
- `DealFullDetail` — interface espelhando a view `deals_full_detail`
- `WinLoseData` — dados para ganhar/perder deal

Atualizar `src/types/deal.ts`:
- Adicionar `canal_origem`, `notas`, `data_previsao_fechamento`, `metadata` ao `DealFormData`

#### Fase 3: Hooks

Criar `src/hooks/useDealDetail.ts`:
- `useDealDetail(dealId)` — query da view `deals_full_detail`
- `useDealActivities(dealId)` — lista atividades com JOIN profiles
- `useAddDealActivity()` — criar atividade manual
- `useToggleTaskActivity()` — toggle checkbox de tarefa
- `useUpdateDealField()` — update campo individual do deal
- `useMoveDealStage()` — mover deal para outro stage via clique na barra
- `useWinDeal()` — marcar como ganho
- `useLoseDeal()` — marcar como perdido
- `useReopenDeal()` — reabrir deal fechado + log REABERTO
- `useDealStageHistory(dealId)` — historico de movimentacoes

#### Fase 4: Componentes

Criar `src/components/deals/DealDetailSheet.tsx`:
- Header: titulo, badges (empresa, pipeline, stage com cor, ganho/perdido), valor, tempo no stage + alerta SLA
- Barra de progresso visual com stages clicaveis (clicar move deal)
- Botoes Ganhar/Perder (ou Reabrir se fechado)
- 4 tabs: Timeline, Dados, Campos Custom, Scores IA
- Timeline: feed cronologico reverso com input inline para adicionar atividades
- Dados: campos do deal com edicao inline
- Campos: `CustomFieldsRenderer` para EAV do deal
- Scores: 4 barras de progresso (Engajamento, Intencao, Valor, Urgencia)
- Dialog de confirmacao para Ganhar/Perder
- Copilot integrado no header (adaptado para `context` object existente)

Criar `src/components/deals/DealCreateDialog.tsx`:
- Modal completo: titulo, contato (busca via useContactsPage), pipeline, stage, valor, temperatura, canal origem, previsao fechamento, notas
- Substitui o `CreateDealDialog` existente em `pipeline/`

#### Fase 5: Integracao

- **PipelinePage.tsx**: Adicionar state `selectedDealId`, passar `onDealClick` ao KanbanBoard, renderizar `DealDetailSheet` e trocar `CreateDealDialog` pelo novo `DealCreateDialog`
- **KanbanBoard.tsx**: Aceitar e propagar `onDealClick` callback
- **KanbanColumn.tsx**: Aceitar e propagar `onDealClick` callback
- **DealCard.tsx**: Adicionar `onClick` prop, separar area clicavel da area de drag
- **ContactDetailSheet.tsx**: Na tab Deals, ao clicar deal abrir `DealDetailSheet` inline

---

### Adaptacoes vs PDF

| Item | PDF | Implementacao real |
|------|-----|--------------------|
| `deal_stage_history.moved_at` | Assume `moved_at` | Usar `created_at` existente |
| `CopilotPanel` props | Props separadas | Usar `context` object existente |
| Policy service role | `FOR ALL USING (true)` | Manter conforme PDF (service_role) |
| `CreateDealDialog` existente | Nao menciona | Substituir pelo novo em `deals/` |
| `status` do deal | PDF usa `is_won`/`is_lost` do stage | Manter compativel com campo `status` existente |

---

### Checklist de validacao (pagina 27 do documento)

1. Migration SQL rodada — tabela deal_activities, trigger, view
2. Verificar: tabela deal_activities existe com trigger trg_deal_activity_log
3. Verificar: view deals_full_detail funciona (SELECT * LIMIT 5)
4. types/dealDetail.ts criado
5. hooks/useDealDetail.ts criado
6. components/deals/DealDetailSheet.tsx criado
7. components/deals/DealCreateDialog.tsx criado
8. Integrar no PipelinePage: handleDealClick + handleNewDeal
9. Integrar no ContactDetailSheet: click deal abre DealDetailSheet
10. Testar: clicar num deal card no kanban — DealDetailSheet abre
11. Testar: tab Timeline — adicionar nota, tarefa (checkbox funciona)
12. Testar: clicar stage na barra de progresso — deal move + atividade auto-registrada
13. Testar: clicar Ganhar — confirmar — badge + atividade GANHO
14. Testar: clicar Perder — preencher motivo — badge + atividade PERDA
15. Testar: clicar Reabrir — deal volta ao primeiro stage + atividade REABERTO
16. Testar: criar novo deal via DealCreateDialog (botao Novo Deal no kanban)
17. Testar: custom fields do deal (tab Campos) renderizados e editaveis
18. Testar: Copilot no header do deal — perguntar sobre este deal

