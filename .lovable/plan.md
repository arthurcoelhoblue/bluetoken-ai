

# Diagnóstico: Widget WebRTC "liga mas não chama"

## Problema raiz
O `dial()` no hook `useZadarmaWebRTC` dispara um `CustomEvent('zadarmaWidgetEvent', { event: 'makeCall' })` — mas esse evento é capturado pelo **nosso próprio listener**, não pelo widget Zadarma. O widget Zadarma não expõe uma API programática para iniciar chamadas. Resultado: o status muda para "Chamando..." na nossa UI, mas nenhuma chamada real acontece.

O console confirma: `[WebRTC] Widget event: makeCall` é o nosso próprio evento ecoando de volta.

## O que funciona
O click-to-call dentro do cadastro do cliente funciona porque usa o **Callback API** (`/v1/request/callback/`), que é server-side e funciona corretamente.

## Solução
Duas mudanças:

### 1. Tornar o widget Zadarma visível (`useZadarmaWebRTC.ts`)
Mudar o parâmetro `visible` de `false` para `true` na chamada `zadarmaWidgetFn()`. Isso faz o softphone nativo do Zadarma aparecer no canto, permitindo receber chamadas e discar manualmente pelo widget deles.

### 2. Usar Callback API no dial do widget flutuante (`ZadarmaPhoneWidget.tsx`)
Quando o usuário clica "Ligar" no nosso widget flutuante, usar sempre o `proxy.mutate({ action: 'click_to_call' })` (Callback API), independente do modo WebRTC. O WebRTC cuida apenas do áudio — o ramal toca via callback, o widget Zadarma (agora visível) atende automaticamente, e a chamada conecta.

Remover o branch `if (isWebRTCMode && webrtc.isReady)` do `handleDial` para que sempre use callback.

### 3. Resultado esperado
- Widget Zadarma visível no canto (softphone nativo para receber/fazer chamadas)
- Botão "Ligar" do nosso widget usa callback API (confiável, já testado)
- O WebRTC no browser cuida do áudio (sem precisar de app externo)

