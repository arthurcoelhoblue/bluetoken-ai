

# Diagnóstico: Telefone disparando ligação sozinho

## Causa raiz identificada

Existem **dois problemas combinados** que causam o auto-dial fantasma:

### 1. postMessage com keyword muito ampla (linha 495)
O listener de `postMessage` usa `combined.includes('invite')` — qualquer mensagem de qualquer iframe que contenha a palavra "invite" (ex: convites do Sentry, mensagens do Lovable preview, etc.) dispara o `triggerAutoAnswer()`.

### 2. `clickAnswerButton` clica no botão de LIGAR em vez do botão de ATENDER
O seletor `[class*="zdrm-webphone-call-btn"]:not([class*="decline"])` (linha 96) corresponde ao **botão genérico de fazer chamada** do widget Zadarma, não apenas ao botão de atender. Quando o `triggerAutoAnswer` é ativado por um falso positivo, ele clica nesse botão, que inicia uma chamada para o número que estiver no campo de input do widget oculto.

### Fluxo do bug:
```
postMessage com "invite" (falso positivo)
  → triggerAutoAnswer()
    → clickAnswerButton()
      → clica em [class*="zdrm-webphone-call-btn"] (botão de LIGAR)
        → widget Zadarma faz chamada para número aleatório
```

## Solução

**Arquivo: `src/hooks/useZadarmaWebRTC.ts`**

### Correção 1: Restringir keyword no postMessage (linha 495)
Trocar `combined.includes('invite')` por `combined.includes('invite received')` para evitar falsos positivos.

### Correção 2: Remover seletor perigoso do `clickAnswerButton` (linha 96)
Remover `'[class*="zdrm-webphone-call-btn"]:not([class*="decline"])'` da lista de seletores do `clickAnswerButton`. Este seletor corresponde ao botão de iniciar chamada, não ao de atender.

### Correção 3: Adicionar guard de estado no `triggerAutoAnswer`
Só permitir auto-answer quando o status atual é `ready` (idle). Se o status já for `calling`, `active`, ou `dialing`, bloquear a execução.

### Correção 4: Adicionar guard no console.log interceptor
Aplicar a mesma verificação de estado no interceptador de `console.log` para a detecção de "incoming" — só disparar se o status for `ready`.

Essas 4 mudanças eliminam tanto a causa (falsos positivos) quanto o efeito (clicar no botão errado), tornando o sistema robusto contra regressões.

