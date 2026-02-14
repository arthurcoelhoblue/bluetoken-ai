

# Unificacao Cadencias SDR + CRM (8.3)

## Situacao Atual

Existem **duas interfaces separadas** no sidebar e no frontend para gerenciar o mesmo recurso (cadencias):

| Aspecto | SDR (`/cadences`) | CRM (`/cadencias-crm`) |
|---|---|---|
| Sidebar | "Cadencias" | "Cadencias CRM" |
| Tabela base | `cadences` + `cadence_steps` | Mesmas tabelas (via view `cadencias_crm`) |
| Runs | `lead_cadence_runs` | `lead_cadence_runs` + bridge `deal_cadence_runs` |
| UI | Lista completa, editor, detalhe, runs, next-actions | Grid de cards + config de triggers |
| Hooks | `useCadences.ts` (698 linhas) | `useCadenciasCRM.ts` (166 linhas) |
| Tipos | `types/cadence.ts` (unificado) | `types/cadencias.ts` (re-export) |

**Problema**: Ambos operam sobre a mesma tabela `cadences`, mas a experiencia esta fragmentada em dois menus e duas paginas distintas. O gestor precisa navegar para `/cadencias-crm` apenas para ver stats de deals e configurar triggers.

## Plano de Unificacao

### 1. Sidebar: entrada unica

Remover "Cadencias CRM" do sidebar. Manter apenas "Cadencias" (`/cadences`) como ponto de entrada unico.

### 2. CadencesList: adicionar aba de Triggers

Transformar a pagina `/cadences` (CadencesList) para incluir **Tabs**:
- **Tab "Cadencias"**: tabela existente (lista todas as cadencias com stats de leads + deals)
- **Tab "Triggers CRM"**: mover o conteudo de triggers automaticos que hoje esta em CadenciasPage

### 3. Enriquecer a tabela de cadencias

Na tabela da aba "Cadencias", adicionar as colunas de stats CRM que hoje so aparecem na pagina separada:
- **Deals Ativos**: quantos deals tem cadencia ativa
- **Deals Concluidos**: quantos deals completaram
- Dados vindos da view `cadencias_crm` ja existente

### 4. CadenceDetail: adicionar secao de Deals

Na pagina de detalhe de uma cadencia (`/cadences/:id`), adicionar uma secao mostrando os deals vinculados via `deal_cadence_runs`, com status e progresso (similar ao que o `DealCadenceCard` mostra, mas na perspectiva da cadencia).

### 5. Remover pagina e rota duplicada

- Deletar `src/pages/CadenciasPage.tsx`
- Remover rota `/cadencias-crm` do `App.tsx` (manter redirect para `/cadences`)
- Remover entrada "Cadencias CRM" do `AppSidebar.tsx`

### 6. Consolidar hooks

Mover as funcoes de triggers (`useCadenceStageTriggers`, `useCreateStageTrigger`, `useDeleteStageTrigger`) de `useCadenciasCRM.ts` para dentro de `useCadences.ts`. As funcoes de deal-cadence (`useStartDealCadence`, `usePauseDealCadence`, etc.) permanecem em `useCadenciasCRM.ts` pois sao usadas pelo `DealCadenceCard` no contexto de deals.

### 7. Deletar arquivo de tipos legado

Remover `src/types/cadencias.ts` (ja e apenas re-export de `cadence.ts`). Atualizar os imports em `useCadenciasCRM.ts` e `DealCadenceCard.tsx` para apontar direto para `types/cadence`.

---

## Detalhes Tecnicos

### Arquivos modificados

| Arquivo | Acao |
|---|---|
| `src/components/layout/AppSidebar.tsx` | Remover item "Cadencias CRM" |
| `src/App.tsx` | Rota `/cadencias-crm` vira redirect para `/cadences` |
| `src/pages/CadencesList.tsx` | Adicionar Tabs (Cadencias + Triggers CRM), enriquecer stats |
| `src/pages/CadenceDetail.tsx` | Adicionar secao "Deals Vinculados" |
| `src/hooks/useCadences.ts` | Adicionar hooks de triggers (stage triggers) |
| `src/hooks/useCadenciasCRM.ts` | Remover hooks de triggers, manter apenas deal-cadence ops |
| `src/components/cadencias/DealCadenceCard.tsx` | Atualizar import para `types/cadence` |

### Arquivos deletados

| Arquivo | Motivo |
|---|---|
| `src/pages/CadenciasPage.tsx` | Substituida pela aba em CadencesList |
| `src/types/cadencias.ts` | Re-export desnecessario |

### Fluxo unificado

```text
Sidebar "Cadencias"
    |
    v
/cadences (CadencesList)
    |
    +-- Tab "Cadencias" --> Tabela com stats SDR + CRM
    |       |
    |       +--> Click --> /cadences/:id (CadenceDetail)
    |                         |
    |                         +-- Metricas SDR (runs, eventos)
    |                         +-- Secao "Deals Vinculados" (nova)
    |                         +-- Steps / Editor
    |
    +-- Tab "Triggers CRM" --> Config de triggers por pipeline
            (migrado de CadenciasPage)
```

### Dados da view `cadencias_crm`

A view ja consolida tudo que precisamos (stats de deals + triggers). Basta consumir no hook `useCadences` via query adicional para enriquecer as stats de deals na tabela unificada.

