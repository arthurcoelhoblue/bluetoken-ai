

## Diagnóstico

A cadeia de overflow impede scroll vertical dos deals dentro de cada coluna:

```text
AppLayout (line 41): overflow-y-auto overflow-x-hidden  ✓
  └─ PipelinePage (line 144): overflow-y-hidden  ← BLOQUEIA scroll vertical
       └─ KanbanBoard wrapper (line 179): overflow-hidden, flex-1 min-h-0
            └─ Carousel (line 185): overflow-hidden
                 └─ scrollRef (line 215): overflow-x-auto overflow-y-hidden  ← BLOQUEIA
                      └─ KanbanColumn: flex flex-col, sem altura máxima
                           └─ Drop area: flex-1, sem overflow-y-auto  ← NÃO SCROLLA
```

As colunas crescem infinitamente com os deals mas nenhum container permite scroll vertical. O `overflow-y-hidden` na PipelinePage e no scrollRef cortam tudo que excede a tela.

## Solução

Fazer cada **coluna do Kanban** ter scroll vertical independente, mantendo a altura restrita ao viewport:

### 1. `KanbanColumn.tsx` — Adicionar scroll vertical na área de deals

A drop area (div que contém os cards) precisa de `overflow-y-auto` e altura máxima controlada pelo flex layout:

```tsx
// Drop area: adicionar overflow-y-auto e flex-1 com min-h-0
<div ref={setNodeRef} className="flex-1 min-h-0 flex flex-col gap-1.5 p-1.5 overflow-y-auto ...">
```

### 2. `KanbanBoard.tsx` — Garantir que o container flex passa altura correta

O `scrollRef` (line 215) precisa de `h-full` e o container interno dos deals precisa restringir altura:

- Linha 216: mudar `min-h-[400px]` para `h-full` para que as colunas preencham o espaço disponível sem ultrapassar

### 3. `KanbanColumn.tsx` — Restringir altura da coluna

A coluna raiz precisa participar do flex com altura máxima:

```tsx
// Raiz: adicionar h-full para preencher o container
<div className="flex flex-col w-64 shrink-0 h-full ...">
```

| Arquivo | Mudança |
|---------|---------|
| `KanbanColumn.tsx` | `overflow-y-auto` + `min-h-0` na drop area; `h-full` na raiz |
| `KanbanBoard.tsx` | Container interno: `h-full` em vez de `min-h-[400px]` |

Resultado: cada coluna terá scroll vertical independente, os deals não ficam cortados pelo viewport.

