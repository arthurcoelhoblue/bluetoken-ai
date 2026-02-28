

# Plano: Esconder widget nativo + auto-atender chamadas

## Análise dos logs
Os logs mostram que o `click_to_call` retorna `success`, mas logo em seguida aparece `[WebRTC] Widget event: hangup`. Isso acontece porque:

1. O callback API (`/v1/request/callback/`) manda o Zadarma ligar para o ramal 108
2. O widget WebRTC do Zadarma toca no navegador (incoming call)
3. Ninguém atende manualmente no widget nativo → a chamada cai

## Correções

### 1. Esconder o widget nativo do Zadarma com CSS
Inicializar o widget com `visible: false` novamente (voltar ao modo invisível) e adicionar CSS para garantir que qualquer elemento do Zadarma fique escondido. O widget continua funcional para áudio, apenas invisível.

**Arquivo:** `useZadarmaWebRTC.ts` — mudar `visible` de `true` para `false` + adicionar CSS override para esconder elementos do iframe.

### 2. Auto-atender chamadas recebidas (incoming)
Quando o widget Zadarma detecta um evento `incoming` ou `ringing`, chamar automaticamente `answer()` para aceitar a chamada sem interação manual. Isso faz o fluxo ser: Ligar → callback → ramal toca → auto-atende → chamada conecta.

**Arquivo:** `useZadarmaWebRTC.ts` — no listener de eventos, ao detectar `incoming`/`ringing`, disparar auto-answer via postMessage para o iframe.

### 3. Adicionar CSS global para esconder o widget Zadarma
Adicionar regra CSS no `index.css` para esconder qualquer iframe/div do Zadarma que apareça na tela.

**Arquivo:** `src/index.css`

## Resultado esperado
- Widget nativo do Zadarma invisível (sem o botão verde no canto)
- Fluxo automático: clica "Ligar" → callback → auto-atende → chamada conecta
- Todo o controle visual fica no nosso widget customizado

