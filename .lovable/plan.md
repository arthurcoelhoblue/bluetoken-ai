

# Patch 1: Pipeline Kanban + Modelo de Dados CRM

## Resumo

Implementar o Pipeline Kanban completo com modelo de dados CRM de 3 camadas (Pessoa > Contact > Deal), drag-and-drop entre stages, filtros por pipeline/vendedor/temperatura, e seed data para Blue e Tokeniza.

---

## Parte 1: Banco de Dados (5 novas tabelas)

### Migration SQL

Criar em uma unica migration:

1. **pipelines** -- Pipelines configuraveis por empresa (Blue, Tokeniza). Cada empresa pode ter multiplos pipelines com um default.
2. **pipeline_stages** -- Stages configuraveis por pipeline com posicao, cor, is_won, is_lost, sla_minutos. Constraint UNIQUE(pipeline_id, posicao) e CHECK NOT(is_won AND is_lost).
3. **contacts** -- Evolucao do lead_contacts. Relacao pessoa-empresa com owner, tags, tipo, canal_origem. Mantém retrocompatibilidade com legacy_lead_id.
4. **deals** -- Oportunidade de venda vinculada a 1 contact, 1 pipeline, 1 stage. Campos: titulo, valor, moeda, owner_id, temperatura, posicao_kanban, fechado_em.
5. **deal_stage_history** -- Log automatico de movimentacao entre stages com tempo no stage anterior calculado.

### Trigger automatico

Function `log_deal_stage_change()` -- trigger AFTER UPDATE em deals que detecta mudanca de stage_id e insere automaticamente em deal_stage_history com calculo de tempo.

### RLS

- pipelines, pipeline_stages: SELECT para autenticados, ALL para ADMIN
- contacts: SELECT para autenticados, ALL para ADMIN e CLOSER
- deals: SELECT para autenticados, ALL para ADMIN e CLOSER
- deal_stage_history: SELECT para autenticados, INSERT para autenticados

### Seed Data

| Pipeline | Empresa | Stages |
|----------|---------|--------|
| Novos Negocios | BLUE | Lead, Contato Iniciado, Negociacao, Aguardando Pagamento, Vendido (won), Perdido (lost) |
| Novos Negocios | TOKENIZA | Prospect, Analise de Perfil, Apresentacao de Oferta, Due Diligence, Contrato Assinado (won), Perdido (lost) |

### Indexes

Indexes otimizados para as queries mais frequentes: deals abertos por empresa+pipeline+stage, contacts por empresa/nome/email/telefone.

---

## Parte 2: Dependencia npm

Instalar `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` para o drag-and-drop do kanban.

---

## Parte 3: Frontend

### Tipos -- `src/types/deal.ts`

Interfaces para Pipeline, PipelineStage, PipelineWithStages, Contact, Deal, DealWithRelations, DealStageHistory, DealFormData, DealMoveData, KanbanColumn.

### Hooks

| Hook | Arquivo | Funcao |
|------|---------|--------|
| usePipelines | `src/hooks/usePipelines.ts` | Lista pipelines com stages, filtrado por empresa ativa |
| usePipelineStages | `src/hooks/usePipelines.ts` | Stages de um pipeline especifico |
| useDeals | `src/hooks/useDeals.ts` | Lista deals com joins (contact, stage, owner), filtros por pipeline/owner/temperatura |
| useKanbanData | `src/hooks/useDeals.ts` | Transforma deals em KanbanColumn[] agrupados por stage, separa won/lost |
| useCreateDeal | `src/hooks/useDeals.ts` | Mutation para criar deal + log inicial em history |
| useUpdateDeal | `src/hooks/useDeals.ts` | Mutation para atualizar deal |
| useMoveDeal | `src/hooks/useDeals.ts` | Mutation para mover deal entre stages (trigger cuida do history) |
| useDeleteDeal | `src/hooks/useDeals.ts` | Mutation para deletar deal |
| useContacts | `src/hooks/useContacts.ts` | Lista contacts filtrados por empresa, com busca por nome/email/telefone |
| useCreateContact | `src/hooks/useContacts.ts` | Mutation para criar contact |

### Componentes Pipeline

| Componente | Descricao |
|-----------|-----------|
| `src/components/pipeline/DealCard.tsx` | Card draggable com titulo, valor formatado (BRL), badges de empresa/temperatura/canal, owner e dias no stage. Usa `useSortable` do dnd-kit. |
| `src/components/pipeline/KanbanColumn.tsx` | Coluna droppable com header (nome do stage, contagem, total R$), lista de DealCards, placeholder "Arraste deals aqui" quando vazia. |
| `src/components/pipeline/KanbanBoard.tsx` | Board principal com DndContext, sensores Pointer+Keyboard, DragOverlay para feedback visual durante arraste, skeleton loading. |
| `src/components/pipeline/PipelineFilters.tsx` | Barra de filtros: select de pipeline, select de vendedor, select de temperatura, botao "Novo Deal". |

### Pagina -- `src/pages/PipelinePage.tsx`

Substituir o shell atual por pagina funcional:
- Auto-seleciona pipeline default quando carrega
- Reseta selecao quando empresa ativa muda
- Barra de filtros no topo
- KanbanBoard ocupando area principal com scroll horizontal
- Mensagem quando nenhum pipeline encontrado

---

## Sequencia de implementacao

| # | Acao |
|---|------|
| 1 | Migration SQL: criar 5 tabelas + trigger + seed + RLS + indexes |
| 2 | Instalar @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities |
| 3 | Criar `src/types/deal.ts` |
| 4 | Criar `src/hooks/usePipelines.ts` |
| 5 | Criar `src/hooks/useDeals.ts` |
| 6 | Criar `src/hooks/useContacts.ts` |
| 7 | Criar `src/components/pipeline/DealCard.tsx` |
| 8 | Criar `src/components/pipeline/KanbanColumn.tsx` |
| 9 | Criar `src/components/pipeline/KanbanBoard.tsx` |
| 10 | Criar `src/components/pipeline/PipelineFilters.tsx` |
| 11 | Substituir `src/pages/PipelinePage.tsx` |

## Impacto

- Zero alteracao em tabelas existentes (lead_contacts, pessoas, etc. continuam intactos)
- Novas tabelas com foreign keys para pessoas e profiles
- Pipeline page substitui o shell placeholder
- Demais paginas e funcionalidades nao sao afetadas

