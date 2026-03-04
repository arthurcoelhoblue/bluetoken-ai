

## Diagnóstico Completo

Analisei toda a cadeia de layout: `AppLayout` → `PipelinePage` → `KanbanBoard` → scroll container. Encontrei **duas causas raiz**:

### Problema 1: Scroll horizontal da pagina

A cadeia de overflow está quebrada. O conteúdo do Kanban usa `minWidth: 'max-content'` para forçar largura das colunas, mas o wrapper do carrossel (`<div className="relative flex-1 min-h-0">`, linha 185 do KanbanBoard) **não tem restrição de largura nem overflow-hidden**. Isso faz com que o conteúdo "vaze" para cima na hierarquia:

```text
AppLayout: overflow-auto (linha 41)  ← MOSTRA SCROLLBAR
  └─ PipelinePage: overflow-x-hidden  ← tenta bloquear mas...
       └─ flex-1 min-h-0 overflow-hidden  ← ok
            └─ KanbanBoard wrapper: relative flex-1 min-h-0  ← SEM overflow-hidden!
                 └─ scrollRef: overflow-auto  ← scroll interno ok
                      └─ flex gap-4 minWidth:max-content  ← expande largura
```

O wrapper do carrossel expande sem limite, empurrando o PipelinePage, que por sua vez faz o `overflow-auto` do AppLayout mostrar scrollbar horizontal.

### Problema 2: Grab scroll não funciona

O `DealCard` espalha `{...attributes, ...listeners}` diretamente no Card (linha 67). Os listeners do dnd-kit incluem `onPointerDown` que chama `setPointerCapture()` no elemento do card. Isso redireciona **todos** os eventos de pointer subsequentes para aquele elemento, fazendo com que o `pointermove` no `window` (usado pelo grab scroll) nunca receba os eventos -- mesmo em capture phase.

O `useGrabScroll` intercepta `pointerdown` em capture (correto), mas não impede o dnd-kit de também receber o `pointerdown` no card (que acontece na fase de bubble). Quando o dnd-kit detecta 8px de movimento, ele ativa o sensor e captura o ponteiro antes que o grab scroll tenha chance de decidir o eixo.

## Solução

### Arquivo 1: `src/components/pipeline/KanbanBoard.tsx`

- **Carousel wrapper**: Adicionar `overflow-hidden` ao div wrapper do carrossel (linha 185) para conter a largura do conteúdo interno e impedir vazamento para os containers pais
- **Scroll container**: Mudar de `overflow-auto` para `overflow-x-auto overflow-y-hidden` para restringir scroll apenas ao eixo horizontal

### Arquivo 2: `src/components/layout/AppLayout.tsx`

- Mudar o content wrapper (linha 41) de `overflow-auto` para `overflow-y-auto overflow-x-hidden` como proteção adicional contra qualquer página que tente expandir horizontalmente

### Arquivo 3: `src/hooks/useGrabScroll.ts`

- No `onPointerDown` em capture: quando o clique acontece sobre a área de scroll (e não sobre botões), chamar `e.stopPropagation()` imediatamente para impedir o dnd-kit de receber o evento nos filhos
- Salvar o `pointerId` para usar `releasePointerCapture` caso o dnd-kit consiga capturar
- No `onPointerMove`: quando o eixo é detectado como **vertical** (released), re-disparar um novo `pointerdown` sintético para que o dnd-kit possa ativar normalmente para drag de cards verticais
- Quando eixo é horizontal: manter o `stopImmediatePropagation` atual

A ideia central: bloquear o `pointerdown` de chegar ao dnd-kit inicialmente, e só liberá-lo quando confirmarmos que o movimento é vertical (drag de card) e não horizontal (scroll do carrossel).

```text
pointerdown (capture, container):
  ├─ É sobre botão/link? → ignora
  └─ Senão → stopPropagation + registra posição
                (dnd-kit NÃO recebe pointerdown)

pointermove (capture, window):
  ├─ < 8px → aguarda
  ├─ horizontal → lock, scroll, stopImmediatePropagation
  └─ vertical → release, re-dispatch pointerdown sintético no target
                  (dnd-kit AGORA recebe e pode iniciar drag)

pointerup (capture, window):
  └─ reset
```

| Arquivo | Mudanca |
|---------|---------|
| `src/components/layout/AppLayout.tsx` | `overflow-auto` → `overflow-y-auto overflow-x-hidden` |
| `src/components/pipeline/KanbanBoard.tsx` | Adicionar `overflow-hidden` no wrapper do carrossel; scroll container `overflow-x-auto overflow-y-hidden` |
| `src/hooks/useGrabScroll.ts` | Bloquear pointerdown na captura, re-disparar se movimento vertical |

