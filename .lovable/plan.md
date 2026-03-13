

## Diagnostico: Race Condition no Login

### O que acontece passo a passo:

1. Usuario faz login com sucesso
2. `onAuthStateChange` dispara → seta user/session, mas agenda `fetchProfile` via `setTimeout(0)` (deferred)
3. UI renderiza imediatamente: `isLoading=false`, `isAuthenticated=true`, **mas `roles=[]`** (perfil ainda nao carregou)
4. `ProtectedRoute` renderiza: `isAdmin=false` (roles vazio), prossegue para checagem de permissoes
5. `useScreenPermissions` dispara query com `roles=[]`
6. Sem role ADMIN, consulta `user_access_assignments` no banco
7. Se nao encontra assignment ou cai no fallback com roles vazias → **todas as permissoes = false**
8. `ProtectedRoute` ve `permissions[screenKey].view = false` → redireciona para `/unauthorized`
9. Quando roles finalmente carregam, a queryKey de permissoes NAO muda (porque `isAdmin` continua false para non-admin), entao o resultado cached "deny all" persiste

**Resultado**: Apos login, usuario fica preso em spinner ou vai para /unauthorized. Recarregar pode ou nao ajudar dependendo do timing.

### Por que acontece no preview tambem
Mesma logica: bootstrap termina, mas roles chegam depois. A query de permissoes ja executou com roles vazias e cacheou o resultado errado.

---

## Correcao (3 arquivos)

### 1. `src/hooks/useScreenPermissions.ts`
- Incluir `roles` no queryKey para que a query re-execute quando roles carregam
- Adicionar `enabled: !!user && roles.length > 0` para nao executar com roles vazias
- Mudar de: `queryKey: ['screen-permissions', user?.id, isAdmin]`
- Para: `queryKey: ['screen-permissions', user?.id, roles.join(',')]`

### 2. `src/components/auth/ProtectedRoute.tsx`
- Adicionar checagem: se autenticado mas `roles` ainda esta vazio E `profile` e null, mostrar loading breve (roles estao carregando)
- Isso evita que o gate de permissoes decida com dados incompletos

### 3. `src/contexts/AuthContext.tsx`
- Adicionar flag `profileLoaded` para que ProtectedRoute saiba se o perfil ja foi buscado (mesmo que retorne vazio)
- Garantir que apos login via `signInWithEmail`, `fetchProfile` seja awaited (nao apenas deferred via setTimeout)

### Resultado esperado
- Login → aguarda roles carregarem (< 1s) → renderiza pagina corretamente
- Sem race condition, sem cache de permissoes erradas
- Timeout de seguranca mantido para caso extremo

