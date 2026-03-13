

## Plano de Execução — 6 Ações na Ordem Exata

Diagnóstico confirmado nos arquivos atuais. Os 3 bugs estão presentes:

1. **`ChunkErrorBoundary.tsx` linha 19**: `throw error` em `getDerivedStateFromError` — mata o React
2. **`ErrorBoundary.tsx` linhas 32-38**: `isContextMismatchError` tratado como recuperável → auto-reload → loop infinito
3. **Três contadores independentes**: `eb-recoverable-reload`, `chunk-error-reload`, `global-chunk-reload` → até 6 reloads

Nenhum import direto de `@sentry/react` foi encontrado fora de `sentry.ts` (já resolvido anteriormente).

---

### AÇÃO 1: Substituir `src/components/ChunkErrorBoundary.tsx` inteiro
Conteúdo exato fornecido pelo usuário. Remove o `throw error`, adiciona fallback genérico para erros não-chunk, zero auto-reload.

### AÇÃO 2: Substituir `src/components/ErrorBoundary.tsx` inteiro
Conteúdo exato fornecido pelo usuário. Remove toda lógica de auto-reload, remove `isRecoverableError`, remove contadores `sessionStorage`. Apenas UI com botões manuais.

### AÇÃO 3: Substituir `src/lib/sentry.ts` inteiro
Stubs vazios. `initSentry()`, `captureException()`, `captureMessage()`, `setUser()`, `withScope()` — todos no-op com console log.

### AÇÃO 4: Limpar `src/main.tsx`
Remover todo o bloco de auto-reload (linhas 10-71): contadores, `doControlledReload`, `isChunkLikeError`, handlers de `vite:preloadError`, `unhandledrejection`, `error`. Substituir por handlers que apenas logam no console (zero `window.location.reload()`).

### AÇÃO 5: Proteger `src/contexts/AuthContext.tsx`
O bootstrap já tem try/catch adequado. A única mudança: envolver o callback de `onAuthStateChange` em try/catch para que erros no listener não crashem o app. O `handleClearSession` (linha 144) mantém `window.location.reload()` pois é ação manual do usuário (botão).

### AÇÃO 6: Validação (grep)
Confirmar que após as mudanças:
- Zero `window.location.reload()` automático (apenas em onClick de botões)
- Zero `throw error` em `getDerivedStateFromError`
- Zero import de `@sentry/react` fora de `sentry.ts`
- Zero `sessionStorage` de contadores de reload

**Arquivos alterados**: 4 (`ChunkErrorBoundary.tsx`, `ErrorBoundary.tsx`, `sentry.ts`, `main.tsx`) + ajuste mínimo no `AuthContext.tsx`.

