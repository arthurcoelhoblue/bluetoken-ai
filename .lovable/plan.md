

## Diagnóstico

O `useGrabScroll` já está implementado e conectado ao `scrollRef` do KanbanBoard. Porém, o problema é que o `dnd-kit` com `PointerSensor` (distance: 5) captura os eventos de mouse antes do grab scroll quando o clique acontece sobre qualquer área dentro de um droppable/sortable context — ou seja, praticamente toda a superfície do board. Isso torna o grab scroll inoperante na prática.

## Plano

### 1. Adicionar botões de navegação horizontal (setas esquerda/direita)

Adicionar dois botões de seta nas laterais do kanban board que permitem navegar horizontalmente com clique. Eles aparecem condicionalmente (só quando há conteúdo para scrollar naquela direção).

**Arquivo:** `src/components/pipeline/KanbanBoard.tsx`
- Adicionar botões `ChevronLeft` / `ChevronRight` posicionados nas bordas esquerda/direita do container
- Scroll suave ao clicar (~300px por clique)
- Mostrar/esconder baseado em `scrollLeft` e `scrollWidth`

### 2. Corrigir conflito entre grab scroll e dnd-kit

**Arquivo:** `src/hooks/useGrabScroll.ts`
- Expandir a lista de exclusão para ignorar mousedown em `[data-sortable]` e dentro de `.dnd-kit` droppable areas (deal cards)
- Garantir que o grab scroll só ativa quando o mouse está no "fundo" do board (espaço entre colunas, header, área vazia)

**Arquivo:** `src/components/pipeline/KanbanBoard.tsx`  
- Adicionar `data-grab-area` no container principal para delimitar a área de grab
- Garantir que o `scrollRef` div tenha `overflow-x: auto` explícito e `cursor: grab`

### 3. Indicadores visuais de scroll

- Gradiente suave nas bordas esquerda/direita quando há mais conteúdo para scrollar, indicando visualmente que o board é arrastável

| Arquivo | Ação |
|---------|------|
| `src/components/pipeline/KanbanBoard.tsx` | Adicionar botões de seta + indicadores de scroll |
| `src/hooks/useGrabScroll.ts` | Ajustar exclusões para coexistir com dnd-kit |

