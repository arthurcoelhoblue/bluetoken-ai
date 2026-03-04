

## Diagnóstico

O problema é que o `useSortable` do dnd-kit espalha `{...listeners}` diretamente no Card (linha 67 do DealCard.tsx). Esses listeners capturam `pointerdown` no card e ativam o sensor do dnd-kit, que então toma controle total do ponteiro via `setPointerCapture`. Isso impede que o `onMouseMove` do grab scroll receba os eventos subsequentes -- o dnd-kit "rouba" o ponteiro antes do hook ter chance de detectar o eixo horizontal.

O `onMouseDown` do hook até dispara (porque mousedown e pointerdown são eventos separados), mas o `onMouseMove` no window nunca recebe os movimentos porque o dnd-kit capturou o ponteiro.

## Solução

Precisamos interceptar **antes** do dnd-kit capturar o ponteiro. A abordagem:

1. **No `useGrabScroll.ts`**: Adicionar listener de `pointerdown` e `pointermove` (em capture phase) além dos mouse events. No `pointermove` em capture, quando o eixo horizontal for detectado, chamar `e.stopPropagation()` e `e.preventDefault()` para impedir o dnd-kit de ativar.

2. **No `DealCard.tsx`**: Não precisa mudar -- os listeners do dnd-kit são `onPointerDown`. O hook intercepta no nível do container em capture phase, que executa antes dos handlers dos filhos.

### Alteração principal: `src/hooks/useGrabScroll.ts`

- Trocar de `mousedown/mousemove/mouseup` para `pointerdown/pointermove/pointerup`
- Registrar `pointerdown` no elemento scroll container em **capture phase**
- Registrar `pointermove` no **window em capture phase** 
- Quando eixo horizontal for detectado no `pointermove`, chamar `e.stopImmediatePropagation()` para impedir o dnd-kit de processar o evento
- Manter touch handlers como fallback para dispositivos que não suportam pointer events

### Detalhe técnico

```text
pointerdown (capture, container) → registra posição
pointermove (capture, window):
  ├─ primeiros 8px: detecta eixo
  │   ├─ horizontal → lock, stopImmediatePropagation, scrollLeft
  │   └─ vertical → release, não interfere
  └─ após lock horizontal → scroll + block propagation
pointerup → reset
```

| Arquivo | Ação |
|---------|------|
| `src/hooks/useGrabScroll.ts` | Migrar para pointer events em capture phase para interceptar antes do dnd-kit |

