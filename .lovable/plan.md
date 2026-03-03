

## Correções: Loop infinito + Redirect URI do Google Calendar

### Problema 1: Loop infinito no CalendarConfigPanel
O `useEffect` na linha 43-47 observa o objeto `config` como dependência. Como o React Query retorna um novo objeto a cada render (mesmo com os mesmos valores), o `useEffect` dispara → chama `setState` → causa re-render → `config` é novo objeto → `useEffect` dispara novamente → loop infinito.

**Correção**: Observar os campos individuais do `config` em vez do objeto inteiro.

```typescript
// ANTES (linha 43-47):
useEffect(() => {
  setDuracao(config.duracao_minutos);
  setBuffer(config.buffer_minutos);
  setMaxDia(config.max_por_dia);
  setMeetEnabled(config.google_meet_enabled);
}, [config]);

// DEPOIS:
useEffect(() => {
  setDuracao(config.duracao_minutos);
  setBuffer(config.buffer_minutos);
  setMaxDia(config.max_por_dia);
  setMeetEnabled(config.google_meet_enabled);
}, [config.duracao_minutos, config.buffer_minutos, config.max_por_dia, config.google_meet_enabled]);
```

Mesma correção para o `useEffect` de `availability` (linha 34-42) — usar `availability.length` como dependência estável.

### Problema 2: Redirect URI
O código atual envia `window.location.origin + '/settings'` como redirect_uri. Se o usuário acessa pelo preview (`lovableproject.com`), essa é a URL enviada ao Google. Mas no Google Cloud Console, provavelmente só está cadastrada `amelia.com.br` ou `sdrgrupobue.lovable.app`.

**Ação necessária do usuário**: No Google Cloud Console → Credentials → OAuth Client, adicionar **todas** as URLs de onde os vendedores vão acessar:
- `https://sdrgrupobue.lovable.app/settings`
- `https://amelia.com.br/settings` (se usar domínio customizado)

Sem alteração de código necessária para isso — o código já usa `window.location.origin` corretamente.

### Arquivos alterados
- `src/components/calendar/CalendarConfigPanel.tsx` (corrigir dependências dos useEffects)

