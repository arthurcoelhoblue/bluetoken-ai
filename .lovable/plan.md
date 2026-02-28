

# Diagnóstico: Auto-answer não funciona

## Problema raiz
Os logs mostram claramente a sequência:
1. `click_to_call` → `success` 
2. `incoming {caller: "351910506655"}` (widget recebe a chamada)
3. 29 segundos depois → `canceled` (ninguém atendeu)

O `autoAnswer()` **nunca executou** porque nosso listener escuta `zadarmaWidgetEvent` (CustomEvent), mas o widget Zadarma **não dispara** CustomEvents. Os logs `incoming`, `registered`, `connected` são console.logs internos do widget, não eventos que chegam ao nosso listener.

O widget Zadarma se comunica via `postMessage` do iframe, não via CustomEvent no window.

## Solução em 2 partes

### 1. Interceptar eventos via `postMessage` (window 'message' listener)
No `useZadarmaWebRTC.ts`, adicionar `window.addEventListener('message', ...)` para capturar mensagens do iframe Zadarma. Quando detectar um evento de chamada recebida, executar o auto-answer.

### 2. Auto-answer robusto com múltiplas estratégias
Quando detectar incoming call via postMessage:
- Enviar `postMessage({ action: 'answer' })` de volta ao iframe
- Tentar `postMessage({ command: 'accept' })` (formato alternativo)
- Fazer o widget visível momentaneamente (`visible: true`) para que o auto-answer funcione, e esconder via CSS overlay (posicionar nosso botão flutuante por cima)

### 3. Adicionar logging de debug
Logar TODOS os postMessages recebidos para entender o formato exato que o Zadarma usa. Isso vai nos permitir ajustar a detecção na próxima iteração.

### Arquivos alterados
- `src/hooks/useZadarmaWebRTC.ts` — adicionar message listener, melhorar auto-answer, widget visible=true com CSS overlay

