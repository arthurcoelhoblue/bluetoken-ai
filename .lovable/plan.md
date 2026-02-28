

# Fix: Botão de ligação não funciona dentro do Deal

## Causa raiz

O console log mostra `User browser disabled autoplaying media`. Quando o botão "Ligar" é clicado **dentro do Deal Sheet**, o fluxo é:

1. `ClickToCallButton.onClick` → dispara `CustomEvent('bluecrm:dial')`
2. `ZadarmaPhoneWidget` recebe o evento → atualiza state
3. `useEffect` (auto-dial) detecta as condições → chama `handleDial()`

O problema: o `handleDial()` roda dentro de um `useEffect`, **não dentro do gesto do usuário (click)**. O browser bloqueia o áudio do WebRTC porque não reconhece contexto de interação do usuário. Quando o callback do Zadarma chega e o widget tenta tocar/conectar áudio, o browser recusa.

Fora do Deal, o usuário clica diretamente no botão "Ligar" do widget — isso É um user gesture, e o browser permite o áudio.

## Problemas secundários

- `CallInfo` e `CallControls` definidos como funções dentro do render causam unmount/remount a cada re-render (timer 1s), o que pode fazer o botão de desligar "falhar" se o click coincide com um re-render
- `triggerAutoAnswer` é chamado múltiplas vezes (6+ no log) resetando o `autoAnswerDoneRef` cada vez

## Alterações

### 1. `src/components/zadarma/ClickToCallButton.tsx`
- No `handleClick`, **desbloquear o AudioContext** antes de disparar o evento (único lugar com user gesture real)
- Chamar `new AudioContext().resume()` para liberar playback de áudio na página

### 2. `src/components/zadarma/ZadarmaPhoneWidget.tsx`
- Remover o auto-dial via `useEffect` + `autoDialRef`
- No handler do evento `bluecrm:dial`, chamar `handleDial` diretamente passando o número como argumento (mantém a cadeia de user gesture via `dispatchEvent` síncrono)
- Criar `handleDialDirect(number)` que aceita o número como parâmetro em vez de ler do state
- Extrair `CallInfo` e `CallControls` para fora do corpo da função (componentes estáveis, sem remount a cada render)

### 3. `src/hooks/useZadarmaWebRTC.ts`
- Debounce `triggerAutoAnswer` — ignorar chamadas repetidas dentro de 2s (evita reset do `autoAnswerDoneRef` por múltiplas detecções "incoming")

## Fluxo corrigido
```text
ClickToCallButton.onClick (user gesture)
  ├─ new AudioContext().resume() → desbloqueia áudio do browser
  ├─ dispatchEvent('bluecrm:dial') (síncrono)
  └─ ZadarmaPhoneWidget handler:
      ├─ setNumber, setContactName, setDealId, setMinimized(false)
      └─ handleDialDirect(number) ← chamado direto, não via useEffect
          └─ proxy.mutate('click_to_call')
              └─ Zadarma callback → WebRTC incoming → auto-answer → áudio funciona ✅
```

