

## Plano: Visão Lista no Pipeline com seleção e edição em massa

### Resumo
Adicionar um toggle Kanban/Lista na página `/pipeline`. A visão lista exibe os deals em tabela com colunas sortáveis, checkbox para seleção em massa e uma barra de ações flutuante para alterações bulk (estágio, vendedor, temperatura, status).

### Arquivos a criar/editar

**1. `src/components/pipeline/PipelineListView.tsx`** (novo)
- Tabela usando os componentes `Table` existentes
- Colunas: checkbox, título, contato, estágio (badge colorido), valor (BRL), temperatura, vendedor, dias no estágio, probabilidade, created_at
- Cabeçalhos clicáveis para ordenação local (título, valor, created_at, temperatura)
- Filtro de texto (busca por título/contato) integrado acima da tabela
- Checkbox "selecionar todos" no header
- Estado de seleção via `Set<string>`
- Click na linha abre o `DealDetailSheet` (reutiliza `onDealClick`)

**2. `src/components/pipeline/BulkActionsBar.tsx`** (novo)
- Barra fixa no rodapé que aparece quando `selectedIds.size > 0`
- Ações disponíveis:
  - **Mover para estágio** — Select com stages do pipeline atual
  - **Alterar vendedor** — Select com owners
  - **Alterar temperatura** — Select FRIO/MORNO/QUENTE
- Botão "Aplicar" executa update em batch
- Botão "Limpar seleção"
- Exibe contagem: "X deals selecionados"

**3. `src/hooks/deals/useDealMutations.ts`** (editar)
- Adicionar `useBulkUpdateDeals()` — recebe `{ dealIds: string[], updates: Partial<{stage_id, owner_id, temperatura}> }` e faz update em batch + log de atividade

**4. `src/hooks/useDeals.ts`** (editar)
- Re-exportar `useBulkUpdateDeals`

**5. `src/components/pipeline/PipelineFilters.tsx`** (editar)
- Adicionar prop `viewMode: 'kanban' | 'list'` e `onViewModeChange`
- Renderizar toggle com ícones `Kanban` / `List` ao lado do seletor de pipeline

**6. `src/pages/PipelinePage.tsx`** (editar)
- Adicionar estado `viewMode` com persistência em localStorage
- Passar `viewMode`/`onViewModeChange` ao `PipelineFilters`
- Renderizar condicionalmente `KanbanBoard` ou `PipelineListView`
- Passar `stages` e `owners` para `PipelineListView`

### Detalhes técnicos

- A visão lista reutiliza a mesma query `useDeals` já existente (mesmos filtros de pipeline, owner, temperatura, tag, etiqueta)
- Ordenação é client-side sobre os dados já carregados (até 500 deals)
- O bulk update usa loop de updates individuais (mesmo pattern do `useTransferDeals`) para respeitar RLS
- Nenhuma migração de banco necessária — usa campos existentes (`stage_id`, `owner_id`, `temperatura`)

### Fluxo do usuário
```text
[Pipeline Filters: toggle Kanban ↔ Lista]
         │
         ├── Kanban → KanbanBoard (atual)
         │
         └── Lista → PipelineListView
                ├── Busca por texto
                ├── Ordenação por coluna
                ├── Checkbox seleção
                └── BulkActionsBar (rodapé flutuante)
                      ├── Mover estágio
                      ├── Alterar vendedor
                      └── Alterar temperatura
```

