

## Diagnostico Definitivo

Identifiquei **dois problemas concretos** que causam o comportamento de "spinner infinito" que voce reporta:

### Problema 1: ErrorBoundary engolindo erros de chunk

O erro principal visivel nos logs e session replay e:
```
TypeError: Importing a module script failed.
```

A hierarquia de error boundaries no `App.tsx` e:
```text
ChunkErrorBoundary          (deveria auto-reload)
  └── ErrorBoundary          (mostra "Algo deu errado")
        └── Suspense         (mostra LoadingSpinner)
              └── Routes
                    └── ProtectedRoute
                          └── Lazy(WorkbenchPage)  ← ERRO AQUI
```

O `ErrorBoundary` esta **mais proximo** do erro e captura TUDO, incluindo erros de chunk. O `ChunkErrorBoundary` (que faria auto-reload) **nunca ve o erro**. Resultado: a tela fica no "Algo deu errado" ou no spinner do Suspense, sem recuperacao automatica.

### Problema 2: fetchProfile chamado 3x simultaneamente

Cada carregamento da pagina dispara `fetchProfile` de 3 fontes diferentes:
1. `onAuthStateChange` via `setTimeout(0)`
2. `initSession` apos `getUser()`
3. `signInWithEmail` apos login

Isso gera 3 PATCHs de `last_login_at` + 3 GETs de `profiles` + 3 GETs de `user_roles` -- tudo visivel nos network requests. Alem disso, `CompanyContext.loadUserCompanies` chama `getUser()` separadamente, adicionando mais uma chamada ao backend.

### Problema 3: CompanyContext duplicando getUser()

`CompanyProvider` chama `supabase.auth.getUser()` independentemente no `loadUserCompanies`, adicionando OUTRA chamada de validacao backend em cada carregamento. Isso compete com o bootstrap do AuthContext.

---

## Plano de Correcao (4 arquivos)

### 1. `src/components/ErrorBoundary.tsx`
- Detectar erros de chunk (`isChunkError`) em `getDerivedStateFromError`
- Se for chunk error, **re-throw** para que o `ChunkErrorBoundary` externo capture e faca auto-reload
- Isso restaura o mecanismo de self-healing que ja existe mas esta sendo bloqueado

### 2. `src/contexts/AuthContext.tsx`
- **Deduplicar fetchProfile**: usar flag `profileFetchInProgress` para evitar chamadas simultaneas
- No `onAuthStateChange`: NAO chamar `fetchProfile` se o `initSession` ja vai chamar
- Adicionar logs de trace em cada etapa: `[Auth:TRACE] getSession start`, `getUser start`, `fetchProfile start/end`, `bootstrap finished: <reason>`
- Isso garante que na proxima ocorrencia, os logs mostram exatamente onde travou

### 3. `src/contexts/CompanyContext.tsx`
- Substituir `supabase.auth.getUser()` por usar o `user` do AuthContext (via prop ou importacao)
- OU usar `supabase.auth.getSession()` (local, sem round-trip ao backend) em vez de `getUser()` (que faz round-trip)
- Isso elimina uma chamada backend redundante que compete com o bootstrap

### 4. `src/components/ChunkErrorBoundary.tsx`
- Melhorar o mecanismo de auto-reload: alem de `sessionStorage`, adicionar log `[ChunkError] Auto-reloading...`
- Garantir que apos 2 tentativas sem sucesso, mostre botao de "Limpar cache e recarregar" que faz hard reload (`location.reload(true)`) + limpa caches

### Resultado esperado
- Erros de chunk → auto-reload automatico (self-healing restaurado)
- Bootstrap sem chamadas duplicadas (6 requests → 2)
- Logs de trace em todas as etapas para diagnostico inequivoco em caso de recorrencia
- Nenhum cenario de spinner infinito sem saida

