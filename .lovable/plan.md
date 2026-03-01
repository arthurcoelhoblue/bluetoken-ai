

## Bug: Copilot trava ao reabrir após fechar durante streaming

### Causa raiz
Quando o usuário fecha o painel do Copilot enquanto a resposta está sendo transmitida (streaming), o estado `isLoading` permanece `true`. Ao reabrir, o textarea e o botão de enviar ficam desabilitados — o Copilot parece "travado".

### Correção em `CopilotPanel.tsx`

1. **Adicionar `AbortController`** para cancelar o fetch quando o painel fecha
2. **Resetar `isLoading` no `onOpenChange`** — quando o painel fecha, forçar `isLoading = false` e abortar qualquer stream em andamento
3. **Usar `useRef` para o AbortController** para que a referência persista entre renders

### Mudanças técnicas

| Arquivo | Mudança |
|---|---|
| `src/components/copilot/CopilotPanel.tsx` | Adicionar `AbortController` ref, abortar stream no close, resetar `isLoading` |

Lógica:
- `const abortRef = useRef<AbortController | null>(null)` 
- No `sendMessage`: criar novo `AbortController`, passar `signal` no `fetch`, guardar em `abortRef`
- No handler de `onOpenChange(false)`: chamar `abortRef.current?.abort()` e `setIsLoading(false)`

