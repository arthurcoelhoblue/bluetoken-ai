

## Corrigir Auto-Atendimento WebRTC nas Chamadas Click-to-Call

### Diagnóstico

O fluxo click-to-call funciona assim:
1. Usuário clica "Ligar" → API `click_to_call` (callback) é chamada
2. Zadarma PBX liga primeiro para o ramal do vendedor (aparece como chamada INCOMING no WebRTC)
3. O widget WebRTC deveria auto-atender essa chamada, mas **falha**

**Causas raiz identificadas:**

1. **Detecção de chamada incoming frágil** — O sistema depende de interceptar `console.log` procurando keywords como `"incomingcall"`, `"incoming call"`, `"invite received"`. O widget Zadarma v9 pode usar padrões diferentes que não são capturados.

2. **Click no botão de atender falha** — O widget é marcado como `inert` com `pointer-events: none` e movido para `left: -9999px`. Mesmo com a remoção temporária, o click programático pode não funcionar porque o widget pode não renderizar o botão enquanto está escondido.

3. **Falta de integração com SIP.js** — O widget v9 carrega internamente uma stack SIP.js. É possível interceptar a sessão SIP e chamar `.answer()` diretamente, o que é muito mais confiável que clicar em botões DOM.

### Solução Proposta

Reestruturar o auto-answer em 3 camadas de fallback:

| Camada | Mecanismo | Confiabilidade |
|---|---|---|
| 1 | Interceptar sessão SIP.js e chamar `session.answer()` | Alta |
| 2 | Listener `zadarmaWidgetEvent` + event-based answer | Média |
| 3 | DOM click no botão (atual, melhorado) | Baixa (fallback) |

### Mudanças Técnicas

**Arquivo:** `src/hooks/useZadarmaWebRTC.ts`

1. **Adicionar flag `pendingOutboundRef`** — Quando o usuário inicia click-to-call, marca que está aguardando o callback ring. Isso permite auto-atender sem depender do status `ready`.

2. **Interceptar sessão SIP.js diretamente** — Após inicializar o widget, procurar pela instância SIP.js no escopo global (`window`) e registrar handler para sessões incoming. Chamar `session.answer({ mediaConstraints: { audio: true, video: false } })` automaticamente.

3. **Adicionar listener para `zadarmaWidgetEvent`** — O widget v9 dispara custom events. Detectar eventos de incoming call e responder via API.

4. **Melhorar detecção via console.log** — Adicionar mais padrões do v9: `"new rtcsession"`, `"newrtcsession"`, `"progress"`, `"ringing"`, `"peerconnection"`.

5. **Melhorar clickAnswerButton** — Antes de clicar, temporariamente mover o widget para posição visível (`left: 0`) além de remover `inert`, para que o botão seja efetivamente renderizado. Adicionar seletores v9 adicionais.

6. **Expor `setPendingOutbound()` no return** — Para o `ZadarmaPhoneWidget` sinalizar quando iniciou click-to-call.

**Arquivo:** `src/components/zadarma/ZadarmaPhoneWidget.tsx`

1. Chamar `webrtc.setPendingOutbound(true)` quando `proxy.mutate('click_to_call')` retornar sucesso, para que o hook saiba que deve auto-atender o próximo ring.

### Fluxo Corrigido

```text
User clicks "Ligar"
  → proxy.mutate('click_to_call')
  → setPendingOutbound(true)
  → Zadarma PBX calls extension
  → SIP INVITE arrives at WebRTC widget
  → [Layer 1] SIP.js session intercepted → session.answer()
  → [Layer 2] zadarmaWidgetEvent detected → triggerAutoAnswer()
  → [Layer 3] console.log pattern matched → clickAnswerButton()
  → Call connects, status → 'active'
```

