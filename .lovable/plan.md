

## Diagnostico: Causa Raiz Identificada

O problema esta no `ErrorBoundary.tsx`, linhas 39-47. O padrao de **re-throw dentro de `getDerivedStateFromError`** esta quebrando o app inteiro.

```text
ErrorBoundary.getDerivedStateFromError(error)
  → detecta chunk error
  → throw error   ← PROBLEMA: React NAO garante propagacao correta
  → app crasha completamente
  → browser mostra "erro inesperado" (pagina em branco)
```

React espera que `getDerivedStateFromError` **retorne um objeto de estado**, nao lance excecoes. Quando lanca, o comportamento e indefinido: em vez de propagar para o `ChunkErrorBoundary` pai, o React crasha o app inteiro. Isso explica a mensagem "erro ocorreu inesperadamente" que o browser mostra — nao e o ErrorBoundary UI, e o proprio browser dizendo que o JavaScript crashou.

Confirmo que os logs trace **estao no codigo** (linhas 31-36 do AuthContext.tsx, usando `console.info`), mas como o app crasha antes de renderizar, eles podem nao aparecer no console do usuario.

## Correcao (1 arquivo principal + 1 ajuste menor)

### 1. `src/components/ErrorBoundary.tsx` — Correcao critica

**Remover os `throw error`** de `getDerivedStateFromError`. Em vez de re-throw, tratar chunk errors e context mismatches **diretamente** dentro do ErrorBoundary:

- Adicionar estado `isRecoverable: boolean` ao state
- Se chunk error ou context mismatch: setar `isRecoverable = true` e disparar auto-reload no `componentDidCatch` (mesma logica do ChunkErrorBoundary: max 2 reloads via sessionStorage, depois UI de recuperacao manual)
- Se erro normal: manter comportamento atual (mostrar "Algo deu errado")
- Resultado: zero throws em getDerivedStateFromError, zero crashes do React

### 2. `src/components/ChunkErrorBoundary.tsx` — Manter como safety net

Sem mudancas. Continua como camada externa de seguranca para qualquer erro que escape o ErrorBoundary (cenario improvavel apos a correcao, mas defesa em profundidade).

### Resultado esperado
- Chunk errors → auto-reload automatico direto no ErrorBoundary (sem re-throw)
- Context mismatches → auto-reload automatico (mesmo tratamento)
- Erros normais → UI "Algo deu errado" com opcao de recarregar
- **Zero cenarios de crash total do app**
- Traces de auth continuam funcionando normalmente

