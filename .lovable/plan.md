
## Scroll contido no Kanban + Efeito carrossel (click-and-drag)

### Problema atual
1. O `AppLayout` tem `overflow-auto` no container dos children (linha 42), o que cria scroll na pagina inteira em vez de apenas no Kanban.
2. Nao existe efeito de "grab to scroll" (carrossel) -- o usuario so pode scrollar com a roda do mouse ou barra de scroll.

### Solucao

**1. Eliminar scroll da pagina no Pipeline**

- Em `AppLayout.tsx`: trocar `overflow-auto` por `overflow-hidden` no container principal dos children, para que cada pagina controle seu proprio scroll.
  - Alternativa mais segura: manter `overflow-auto` no AppLayout mas garantir que o PipelinePage use `h-full overflow-hidden` para conter o scroll internamente.

- Em `PipelinePage.tsx`: garantir que o container principal use `h-full overflow-hidden` (ja esta assim).

- Em `KanbanBoard.tsx`: o div interno ja tem `overflow-auto` -- manter.

**2. Adicionar efeito carrossel (click-and-drag para scrollar)**

Criar um hook customizado `useGrabScroll` que:
- Adiciona event listeners de `mousedown`, `mousemove`, `mouseup` ao container do Kanban
- Muda o cursor para `grab`/`grabbing`
- Faz scroll horizontal ao arrastar (sem conflitar com o drag-and-drop de deals, pois o `PointerSensor` ja tem `activationConstraint: { distance: 5 }`)
- O grab-scroll sera ativado apenas quando o usuario clica no fundo do board (nao em um deal card)

Aplicar esse hook ao container scrollavel do `KanbanBoard`.

### Mudancas por arquivo

**`src/hooks/useGrabScroll.ts`** (novo)
- Hook que recebe uma ref de elemento e adiciona comportamento de grab-to-scroll
- Controla estado `isGrabbing` para mudar cursor
- Calcula delta do mouse para scrollar o container

**`src/components/pipeline/KanbanBoard.tsx`**
- Importar e usar `useGrabScroll` no container `overflow-auto`
- Adicionar `ref` ao div scrollavel
- Aplicar classes de cursor (`cursor-grab` / `cursor-grabbing`)

**`src/components/layout/AppLayout.tsx`**
- Trocar `overflow-auto` por `overflow-hidden` no container dos children para que o Pipeline controle seu scroll interno

**Outras paginas** que dependem do scroll do AppLayout precisarao ter seu proprio `overflow-auto` -- mas como a maioria ja tem containers proprios com scroll, o impacto sera minimo. Se necessario, envolveremos o `{children}` em um wrapper condicional ou adicionaremos `overflow-auto` nas paginas que precisam.

### Detalhes tecnicos

O hook `useGrabScroll`:
```text
mousedown -> registra posicao inicial, ativa grabbing
mousemove -> calcula deltaX/deltaY, aplica scrollLeft/scrollTop
mouseup   -> desativa grabbing
```

Nao usaremos biblioteca externa -- e puro JS com refs do React, leve e sem dependencias.
