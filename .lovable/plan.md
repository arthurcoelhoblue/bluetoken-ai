

# Fix: Auto-Answer e Teclado do Widget de Telefonia

## Problema 1: Auto-answer falha após 10 tentativas

O log do hangup mostra as classes reais do widget Zadarma v9:
```
zdrm-webphone-call-btn zdrm-webphone-decline-btn
```

Isso indica que o botão de aceitar usa o padrão: `zdrm-webphone-call-btn zdrm-webphone-accept-btn`. Os nossos seletores atuais (`[class*="zdrm-webphone-accept"]`) deveriam funcionar — **mas** o botão de aceitar só aparece quando o widget está em estado de ringing, e provavelmente tem a classe `zdrm-webphone-hide`. O código atual pula elementos com `zdrm-webphone-hide` (linha 78) e só tenta o fallback depois de testar todos os seletores.

O problema real: o botão de aceitar pode ter `zdrm-webphone-hide` E estar movido para `-9999px` pelo nosso CSS injetado, tornando o clique ineficaz mesmo no fallback. Precisamos **remover temporariamente** o CSS de ocultação antes de tentar clicar e restaurá-lo depois.

Além disso, devemos adicionar seletores mais abrangentes baseados nas classes reais observadas.

## Problema 2: Teclado não funciona no input

O widget Zadarma oculto pode estar capturando eventos de teclado globalmente (keydown/keypress listeners). Mesmo movido para fora da tela, ele continua ativo no DOM e pode interceptar teclas. A solução é adicionar o atributo `inert` aos elementos do widget para desabilitá-los completamente de interação.

## Alterações — `src/hooks/useZadarmaWebRTC.ts`

### A. `clickAnswerButton()` — Reposicionar temporariamente antes de clicar

Antes de tentar clicar, temporariamente mover o widget de volta à tela, clicar, e esconder novamente. Adicionar seletores:
- `[class*="zdrm-webphone-accept-btn"]`  
- `[class*="zdrm-webphone-call-btn"]:not([class*="decline"])` (quando ringing está ativo)

Remover a lógica de pular `zdrm-webphone-hide` — em vez disso, remover a classe `hide` temporariamente, clicar, e restaurar.

### B. `injectHideCSS()` — Adicionar `pointer-events: none`

Adicionar `pointer-events: none !important;` ao CSS injetado para impedir que o widget oculto capture cliques.

### C. MutationObserver — Adicionar atributo `inert` 

Quando o observer detecta novos elementos do widget, além de aplicar CSS, marcar com `inert` e `tabindex="-1"` para impedir captura de foco e teclado.

### D. `triggerAutoAnswer()` — Desabilitar `inert` temporariamente

Antes da sequência de cliques, remover `inert` de todos os elementos do widget, executar os cliques, e restaurar `inert` após.

### E. `clickHangupButton()` — Mesma lógica de reposicionamento temporário

Aplicar a mesma técnica de remoção temporária de `inert` e CSS para garantir que o botão de hangup seja clicável.

