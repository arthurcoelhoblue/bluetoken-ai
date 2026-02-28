

# Bug: Auto-click nunca funciona porque `offsetParent` é `null`

## Causa raiz

Os logs confirmam que o fluxo funciona até o ponto do click:
1. ✅ `incoming` detectado via console.log intercept
2. ✅ `triggerAutoAnswer` disparado
3. ❌ `clickAnswerButton()` falha 10 vezes → "gave up"

**O problema está na linha 79**: `el.offsetParent !== null`

O CSS de ocultação aplica `position: fixed !important; left: -9999px` aos elementos `zdrm-*`. Para elementos com `position: fixed`, o `offsetParent` retorna **sempre `null`** (especificação do DOM). Portanto, o check `offsetParent !== null` filtra TODOS os elementos do widget, e o click nunca acontece.

## Correção em `src/hooks/useZadarmaWebRTC.ts`

### 1. Remover o check `offsetParent !== null` do `clickAnswerButton()`
- Substituir por um click direto em qualquer elemento que corresponda ao seletor
- Elementos offscreen com `position: fixed` continuam funcionais para `.click()`

### 2. Adicionar log de debug quando elementos são encontrados mas filtrados
- Logar quantos elementos cada seletor encontra para facilitar debug futuro

## Resultado esperado
- `clickAnswerButton()` encontra o botão `zdrm-webphone-call-btn` → `.click()` → chamada atendida automaticamente

