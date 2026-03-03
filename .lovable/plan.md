

## Plano: Resolver "Failed to fetch dynamically imported module" definitivamente

### Causa raiz

O app usa `lazy()` em 70+ páginas. Quando o Vite reconstrói (após edição ou deploy), os hashes dos chunks JS mudam. Se o navegador ainda tem referência aos chunks antigos em memória, o import falha com "Failed to fetch dynamically imported module". Isso acontece tanto no preview de desenvolvimento quanto no app publicado após um novo deploy.

### Solução

Adicionar um **error handler global** no `App.tsx` que intercepta erros de carregamento de chunk e faz reload automático da página (uma única vez, para evitar loops infinitos).

### Mudança

**`src/App.tsx`** -- Envolver o `<Suspense>` com um `ErrorBoundary` que detecta erros de chunk e recarrega:

- Criar um componente `ChunkErrorBoundary` (ou reutilizar o `ErrorBoundary` existente) que, ao capturar um erro cujo `message` contém "Failed to fetch dynamically imported module" ou "Loading chunk", executa `window.location.reload()` automaticamente
- Usar `sessionStorage` com uma flag para evitar loop infinito de reloads (máximo 1 reload por erro)

| Arquivo | Mudança |
|---------|---------|
| `src/App.tsx` | Adicionar `ChunkErrorBoundary` em torno do `Suspense` que faz auto-reload em chunk errors |

Isso resolve o problema tanto no preview quanto em produção, sem afetar a experiência do usuário (o reload é instantâneo e transparente).

