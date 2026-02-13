

## Patch 9: Cadencias CRM

### Resumo

Conectar o sistema de cadencias existente aos deals do CRM. Criar bridge table (`deal_cadence_runs`), config de triggers automaticos (`cadence_stage_triggers`), 2 views, trigger SQL auto-start, componente inline no DealDetail, e pagina admin de cadencias CRM.

---

### Correcoes vs PDF (problemas no schema real)

| PDF assume | Schema real | Correcao |
|------------|------------|----------|
| `NEW.empresa` no trigger SQL | `deals` nao tem coluna `empresa` | JOIN com `pipelines` para obter empresa |
| `lead_cadence_runs.status = 'ACTIVE'` | Status em portugues: `ATIVA`, `CONCLUIDA`, `CANCELADA`, `PAUSADA` | Usar `'ATIVA'` no trigger e mapear nos hooks |
| `deal_cadence_runs.status` em ingles (`ACTIVE`, `PAUSED`...) | Nova tabela, pode definir livremente | Manter ingles na bridge (`ACTIVE/PAUSED/COMPLETED/CANCELLED`) para separar dominios |
| `deal_activities.user_id` no trigger | Trigger AFTER UPDATE pode nao ter `auth.uid()` se chamado por sistema | Usar `COALESCE(auth.uid(), NEW.owner_id)` |

---

### Ordem de implementacao

#### Fase 1: Migration SQL

2 tabelas + 2 views + 1 trigger function:

**Tabela `deal_cadence_runs`** (bridge):
- `deal_id` UUID FK deals
- `cadence_run_id` UUID FK lead_cadence_runs
- `trigger_stage_id` UUID FK pipeline_stages (nullable)
- `trigger_type` TEXT (MANUAL, STAGE_ENTER, STAGE_EXIT, SLA_BREACH)
- `status` TEXT (ACTIVE, PAUSED, COMPLETED, CANCELLED)
- RLS: SELECT para authenticated, ALL para ADMIN/CLOSER via `has_role()`

**Tabela `cadence_stage_triggers`** (config):
- `pipeline_id`, `stage_id`, `cadence_id` UUIDs
- `trigger_type` TEXT (STAGE_ENTER, STAGE_EXIT)
- `is_active` BOOLEAN
- RLS: SELECT para authenticated, ALL para ADMIN via `has_role()`

**View `cadencias_crm`** (SECURITY INVOKER):
- Cadencias com total_steps, deals_ativos, deals_completados, triggers JSON array

**View `deal_cadencia_status`** (SECURITY INVOKER):
- Status da cadencia ativa de cada deal com progresso e proximo step

**Trigger `check_cadence_stage_trigger()`** (SECURITY DEFINER):
- Dispara AFTER UPDATE OF stage_id ON deals
- Busca `legacy_lead_id` do contact vinculado
- Busca `empresa` via JOIN com pipelines (correcao vs PDF)
- Cria `lead_cadence_run` com status `'ATIVA'` (portugues, compativel com sistema existente)
- Cria `deal_cadence_runs` bridge com status `'ACTIVE'`
- Loga atividade no deal

#### Fase 2: Types — `src/types/cadencias.ts`

- `CadenceTriggerType`, `DealCadenceStatus`
- `CadenciaCRM`, `DealCadenciaStatus`, `CadenceStageTrigger`
- `StartDealCadencePayload`

#### Fase 3: Hooks — `src/hooks/useCadenciasCRM.ts`

- `useCadenciasCRM()` — lista cadencias com stats CRM
- `useDealCadenciaStatus(dealId)` — cadencias de um deal
- `useStartDealCadence()` — iniciar manual (cria lead_cadence_run + bridge)
- `usePauseDealCadence()`, `useResumeDealCadence()`, `useCancelDealCadence()`
- `useCadenceStageTriggers(pipelineId)`, `useCreateStageTrigger()`, `useDeleteStageTrigger()`

#### Fase 4: DealCadenceCard — `src/components/cadencias/DealCadenceCard.tsx`

Card inline para o DealDetailSheet:
- Header com icone Zap e badge de cadencias ativas
- Botao "Iniciar" com select de cadencias disponiveis
- Lista de cadencias ativas com progress bar, pause/resume/cancel
- Proximo step com countdown (`formatDistanceToNow`)
- Historico de cadencias concluidas/canceladas

#### Fase 5: Integrar no DealDetailSheet

Adicionar `DealCadenceCard` na tab Timeline do `DealDetailSheet.tsx`, antes da lista de atividades. Buscar `legacy_lead_id` do contact para passar ao card.

#### Fase 6: CadenciasPage — `src/pages/CadenciasPage.tsx`

Pagina admin `/cadencias-crm`:
- Grid de cards com stats CRM (steps, deals ativos, completados)
- Triggers configurados por cadencia
- Dialog "Novo Trigger" (select pipeline, stage, cadencia)
- Listagem de triggers existentes com botao deletar

#### Fase 7: Routing e Sidebar

- Rota `/cadencias-crm` em App.tsx com `requiredRoles={['ADMIN']}`
- Atualizar item "Cadencias" no sidebar para apontar para `/cadencias-crm` ou adicionar sub-item
- Registrar `cadencias_crm` em screenRegistry.ts

---

### Secao tecnica

**Arquivos criados/modificados**:

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar (2 tabelas + 2 views + trigger) |
| `src/types/cadencias.ts` | Criar |
| `src/hooks/useCadenciasCRM.ts` | Criar |
| `src/components/cadencias/DealCadenceCard.tsx` | Criar |
| `src/pages/CadenciasPage.tsx` | Criar |
| `src/components/deals/DealDetailSheet.tsx` | Editar (adicionar DealCadenceCard) |
| `src/App.tsx` | Editar (adicionar rota) |
| `src/config/screenRegistry.ts` | Editar (registrar tela) |

**Correcao critica no trigger**: `deals` nao tem `empresa`, entao o trigger faz `SELECT p.empresa FROM pipelines p WHERE p.id = NEW.pipeline_id` para obter a empresa correta antes de inserir em `lead_cadence_runs`.

**Mapeamento de status**: `lead_cadence_runs` usa PT (`ATIVA`), `deal_cadence_runs` usa EN (`ACTIVE`). O hook `useStartDealCadence` insere `'ATIVA'` no lead_cadence_runs e `'ACTIVE'` no deal_cadence_runs.

---

### Checklist de validacao (sera executado apos implementacao)

1. Tabelas `deal_cadence_runs` e `cadence_stage_triggers` criadas
2. Views `cadencias_crm` e `deal_cadencia_status` funcionam
3. Trigger `check_cadence_stage_trigger` existe
4. Rota `/cadencias-crm` acessivel
5. Pagina CadenciasPage lista cadencias com stats CRM
6. Criar trigger automatico (pipeline + stage + cadencia)
7. DealCadenceCard visivel no DealDetailSheet
8. Iniciar cadencia manualmente no DealCadenceCard
9. Pausar, retomar e cancelar cadencia
10. Mover deal no kanban para stage com trigger (verificar se cadencia inicia)

