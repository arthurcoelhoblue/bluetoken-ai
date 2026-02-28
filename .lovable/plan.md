

# Bug: Hangup não funciona ao ligar pelo deal

## Causa raiz

Os logs mostram:
```
[WebRTC] ✅ Clicked hangup button: [class*="zdrm"][class*="decline"] 
  zdrm-webphone-call-btn zdrm-webphone-decline-btn zdrm-webphone-hide zdrm-webphone-hide zdrm-webphone-hide
```

O `clickHangupButton()` está clicando em um botão **oculto** (`zdrm-webphone-hide`). Este é o botão de "decline" para chamadas recebidas, não o botão de encerrar chamada ativa. O clique não faz nada — a chamada continua ativa no WebRTC.

Quando liga pelo botão flutuante (digitando o número manualmente), o widget pode estar em estado diferente do DOM, com o botão correto visível. Quando liga via deal (auto-dial), o timing diferente faz o seletor encontrar o botão errado primeiro.

## Correção em `src/hooks/useZadarmaWebRTC.ts`

### 1. Filtrar elementos com classe `zdrm-webphone-hide`
Na função `clickHangupButton()`, antes de clicar, verificar se o elemento **não** possui a classe `zdrm-webphone-hide`. Elementos ocultos pelo widget devem ser ignorados.

```typescript
// Antes de el.click():
if (el.classList.contains('zdrm-webphone-hide')) continue;
```

### 2. Aplicar o mesmo filtro em `clickAnswerButton()`
Mesma lógica — não clicar em botões marcados como `hide` pelo widget Zadarma.

### 3. Fallback: se nenhum botão visível for encontrado, tentar clicar sem filtro
Se todos os botões encontrados tiverem `zdrm-webphone-hide`, fazer uma segunda passada sem o filtro como último recurso.

## Resultado esperado
- Hangup clica apenas no botão ativo/visível do widget → chamada encerra corretamente tanto pelo botão flutuante quanto pelo deal.

