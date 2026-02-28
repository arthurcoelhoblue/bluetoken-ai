

# Bug: Botão de desligar não funciona — `hangup()` não clica no widget Zadarma

## Causa raiz

O `webrtc.hangup()` (linha 387-395 de `useZadarmaWebRTC.ts`) apenas envia `postMessage` e `CustomEvent` para o iframe do Zadarma. Porém, o widget Zadarma v9 **não responde** a esses eventos — ele só funciona via clique direto no DOM, exatamente como o botão de atender.

O fluxo de atender funciona porque usa `clickAnswerButton()` que faz `.click()` direto nos elementos `zdrm-*`. Mas o hangup não tem lógica equivalente.

## Correção em `src/hooks/useZadarmaWebRTC.ts`

### 1. Criar função `clickHangupButton()` similar a `clickAnswerButton()`
- Seletores: `[class*="zdrm-webphone-hangup"]`, `[class*="zdrm"][class*="hangup"]`, `[class*="zdrm"][class*="end-call"]`, `[class*="zdrm-webphone-reject"]`
- Clica no primeiro elemento encontrado no DOM

### 2. Atualizar `hangup()` para chamar `clickHangupButton()`
- Chamar `clickHangupButton()` como ação principal
- Manter os `postMessage` como fallback
- Setar status para `'ready'`

## Resultado esperado
- Clicar no botão vermelho de desligar → clica no botão de hangup do widget Zadarma oculto → chamada encerrada

