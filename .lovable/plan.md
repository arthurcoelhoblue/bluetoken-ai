

# Fix: Auto-answer e esconder widget Zadarma

## Problemas identificados

1. **Console.log interceptor nunca ativa** — O `useEffect` que faz monkey-patch no `console.log` verifica `!initializedRef.current`, mas como `initializedRef` é um ref (não state), o efeito roda antes da inicialização, retorna cedo, e nunca re-executa. O interceptor simplesmente nunca é instalado.

2. **Seletores CSS não correspondem ao widget real** — O session replay mostra que o widget usa classes `zdrm-*` (ex: `zdrm-webphone-call-btn-up`, `zdrm-ringing`). Os seletores CSS atuais só cobrem `zadarma`, `webphone`, `phone_widget` — não `zdrm`.

3. **Seletores de auto-click não encontram o botão** — `clickAnswerButton()` procura `[class*="answer"]`, mas o botão real do Zadarma usa classes como `zdrm-webphone-call-btn-up`.

## Correções em `src/hooks/useZadarmaWebRTC.ts`

### 1. Ativar console.log interceptor ANTES da inicialização
- Remover a guarda `!initializedRef.current` do useEffect do interceptor
- Instalar o monkey-patch assim que `enabled` for `true`, independente do estado de init
- Isso garante que quando o widget logar `incoming`, o interceptor já está ativo

### 2. Adicionar seletores `zdrm-*` ao CSS de ocultação
- Adicionar `[class*="zdrm"]` aos seletores do `injectHideCSS()`
- Isso vai esconder todos os elementos do widget que usam o prefixo `zdrm`

### 3. Adicionar seletores `zdrm-*` ao `clickAnswerButton()`
- Adicionar seletores: `[class*="zdrm-webphone-call-btn"]`, `[class*="zdrm-ringing"]`, `[class*="zdrm"][class*="call"]`
- O botão de atender no Zadarma v9 é o elemento com classe `zdrm-webphone-call-btn-up` quando está em estado `zdrm-ringing`

### 4. MutationObserver: detectar elementos `zdrm-*`
- Adicionar verificação de `zdrm` no MutationObserver para detectar novos elementos do widget e aplicar CSS + tentar auto-click

## Resultado esperado
- Interceptor de console.log ativo desde o início → detecta `incoming` → dispara auto-click
- Seletores corretos encontram o botão real do widget → `.click()` funciona
- CSS esconde todos os elementos `zdrm-*` → widget invisível

