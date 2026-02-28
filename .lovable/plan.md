

# Plano: Esconder widget nativo + auto-atender via DOM click

## Diagnóstico real (dos logs)

Os logs do console mostram que os eventos `incoming`, `accepted`, `confirmed` são **console.logs internos do widget Zadarma** — NÃO são postMessages nem CustomEvents. O widget v9 cria elementos diretamente no DOM da página (não num iframe cross-origin), por isso:

1. **CSS não esconde** — os seletores `[id*="zadarma"]` não correspondem aos elementos reais do widget
2. **postMessage não funciona** — o widget não usa iframe cross-origin para a UI, os botões estão no DOM principal
3. **Auto-answer nunca executa** — nenhum dos listeners (postMessage/CustomEvent) detecta o `incoming`

## Solução: MutationObserver + auto-click no botão de atender

Como o widget Zadarma injeta botões diretamente no DOM, podemos:

### 1. MutationObserver para detectar botão de atender (`useZadarmaWebRTC.ts`)
- Observar o DOM com `MutationObserver` para detectar quando o botão de atender (answer/accept) aparece
- Quando detectado, fazer `.click()` automaticamente nele
- Procurar seletores como: `.answer-btn`, `[class*="answer"]`, `[class*="accept"]`, botões com ícone de telefone verde dentro do container do widget

### 2. CSS agressivo para esconder o widget (`useZadarmaWebRTC.ts`)
- Além dos seletores atuais, adicionar seletores mais genéricos que capturem o container real do widget:
  - `#phone_widget`, `#webphone`, `.phone-widget`, `.webphone-container`
  - Qualquer div com `position:fixed` que contenha elementos de telefone
- Manter `visibility: hidden` + `opacity: 0` + `position: fixed; left: -9999px` mas **sem** `pointer-events: none` (para que o auto-click funcione)
- Usar `overflow: hidden; width: 0; height: 0` como alternativa

### 3. Interceptar console.log do widget (debug + detecção)
- Monkey-patch `console.log` temporariamente para capturar as mensagens `incoming`, `registered`, etc. que o widget emite
- Quando detectar `incoming`, disparar o auto-click no botão de atender
- Isso é a forma mais confiável de detectar chamadas recebidas, já que os logs confirmam que o widget usa console.log

### 4. Manter widget `visible: true` (necessário para funcionar)
- O widget precisa estar visible=true para processar chamadas
- A ocultação é feita apenas via CSS

### Arquivo alterado
- `src/hooks/useZadarmaWebRTC.ts` — MutationObserver, console.log interceptor, CSS corrigido

## Resultado esperado
- Widget Zadarma completamente invisível para o usuário
- Chamadas auto-atendidas via click programático no botão do widget
- Fluxo: Ligar → callback API → widget toca → auto-click answer → chamada conecta

