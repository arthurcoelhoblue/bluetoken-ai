

## Diagnóstico: Telefone não liga + FABs bloqueados pelo Sheet

### Problema 1: Transição de status "accepted" nunca dispara

**Causa raiz**: Na linha 415 de `useZadarmaWebRTC.ts`, a condição usa igualdade estrita:
```js
combined === 'confirmed' || combined === 'accepted'
```

Porém o widget Zadarma v9 loga `accepted` com argumentos extras: `accepted { _type: "undefined", value: "undefined" }`. Após concatenação, `combined` vira `"accepted {\"_type\":\"undefined\",\"value\":\"undefined\"}"` — que **nunca** é igual a `"accepted"`.

Resultado: o status WebRTC fica preso em `ringing`, nunca transita para `active`. O phoneState do widget nunca chega a `active`, o timer não inicia, e a UI se comporta de forma inconsistente.

Adicionalmente, o evento `canceled` (quando a outra parte cancela) também não é tratado pelo interceptor, deixando o estado preso.

**Correção em `src/hooks/useZadarmaWebRTC.ts`**:
- Trocar `combined === 'confirmed'` por `combined.startsWith('confirmed')` (ou `.includes()` com guard)
- Trocar `combined === 'accepted'` por `combined.startsWith('accepted')`
- Adicionar `combined.startsWith('canceled')` ao bloco de ENDED para tratar cancelamentos

### Problema 2: Sheet do contato bloqueia FABs flutuantes

**Causa raiz**: O `<Sheet>` (Radix UI) renderiza via **portal** no final do `document.body`. O overlay tem `fixed inset-0 z-50` com `bg-black/80` e captura pointer events. Os FABs (ZadarmaPhoneWidget e CopilotFab) estão dentro do `<SidebarProvider>` no DOM. Embora tenham `z-[9999]`, o portal do Sheet aparece **depois** no DOM, e o overlay com `pointer-events: auto` intercepta cliques antes que alcancem os FABs.

**Correção em `src/components/zadarma/ZadarmaPhoneWidget.tsx` e `src/components/copilot/CopilotFab.tsx`**:
- Envolver o JSX retornado de cada FAB com `ReactDOM.createPortal(..., document.body)` para que fiquem no mesmo nível DOM que os portais do Radix
- Com z-[9999] > z-50 e mesmo nível de portal, os FABs ficarão sempre acima de qualquer Sheet/Dialog

### Arquivos afetados
1. `src/hooks/useZadarmaWebRTC.ts` — fix nas condições de matching
2. `src/components/zadarma/ZadarmaPhoneWidget.tsx` — portal wrapper
3. `src/components/copilot/CopilotFab.tsx` — portal wrapper

