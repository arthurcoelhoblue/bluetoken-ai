

## Diagnóstico: Ligação do Deal não funciona + Sheet fecha ao interagir com FAB

### Causa raiz identificada

Há **dois problemas** que se reforçam:

**1. `onPointerDownOutside` usa `e.target` errado**

O Radix Dialog/Sheet emite um evento customizado no `onPointerDownOutside`. O alvo real do clique **não está em `e.target`** — está em `e.detail.originalEvent.target`. O código atual faz:

```js
const target = e.target as HTMLElement; // ← sempre retorna o DismissableLayer, NÃO o botão clicado
target?.closest?.('[data-fab-widget]') // ← nunca encontra, retorna null
```

Resultado: `preventDefault()` nunca é chamado, o Sheet fecha normalmente ao clicar no FAB do telefone. Mesmo problema no `onInteractOutside`.

**2. `handleOpenChange` intercepta o fechamento com ScheduleActivityDialog**

Mesmo que o `preventDefault` funcionasse, quando o Sheet detecta um clique fora e tenta fechar, `handleOpenChange(false)` verifica se o deal tem atividade futura. Se não tem, abre o `ScheduleActivityDialog` ao invés de fechar — interrompendo o fluxo de ligação.

### Correções

**`src/components/deals/DealDetailSheet.tsx`** — Corrigir acesso ao target do evento Radix:
- `onPointerDownOutside`: usar `e.detail.originalEvent.target` ao invés de `e.target`
- `onInteractOutside`: mesma correção
- Isso fará o `closest('[data-fab-widget]')` funcionar e o `preventDefault()` será chamado corretamente

**`src/components/ui/sheet.tsx`** — Tornar o overlay `pointer-events-none` para que não capture cliques destinados aos FABs:
- Adicionar `pointer-events-none` ao `SheetOverlay`
- Adicionar `pointer-events-auto` ao `SheetPrimitive.Content` para que o conteúdo do Sheet continue funcional
- Isso garante que cliques no FAB (z-[9999]) não sejam interceptados pelo overlay (z-50)

### Arquivos afetados
1. `src/components/deals/DealDetailSheet.tsx` — fix no event target
2. `src/components/ui/sheet.tsx` — overlay pointer-events

