

## Diagnóstico

O bug está na linha 282 do `ZadarmaPhoneWidget.tsx`:

```typescript
const isInCall = phoneState === 'dialing' || phoneState === 'active' || phoneState === 'ended';
```

O estado `'ringing'` **não está incluído** na verificação `isInCall`. O fluxo de chamada de saída é:

1. Você clica "Ligar" → `phoneState = 'dialing'` → `isInCall = true` → mostra tela de chamada com botão desligar ✓
2. O PBX Zadarma faz callback no seu ramal (WebRTC recebe incoming) → `webrtc.status = 'ringing'` → efeito de sync (linha 65) muda `phoneState = 'ringing'` → `isInCall = false` → **volta pro dialpad** ✗
3. Auto-answer aceita → `webrtc.status = 'active'` → `phoneState = 'active'` → `isInCall = true` → volta pra tela de chamada ✓

No passo 2, o widget volta para o dialpad porque `ringing` não é tratado como "em chamada". Se o auto-answer demora ou falha, o usuário fica preso no dialpad sem botão de desligar.

## Correção

Adicionar `'ringing'` à verificação `isInCall`:

```typescript
const isInCall = phoneState === 'dialing' || phoneState === 'ringing' || phoneState === 'active' || phoneState === 'ended';
```

Uma linha. Isso garante que o widget mostra a tela de chamada (com informações do contato, timer e botão de desligar) durante todo o ciclo: discando → tocando → ativa → encerrada.

