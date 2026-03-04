

## Problema

O sistema usa **duas camadas de controle de acesso** que estão em conflito:

1. **Legada**: tabela `user_roles` com roles como `READONLY`, `CLOSER`, `ADMIN`. Usada por `ProtectedRoute` (via `hasRole`) e por verificações diretas como `roles.includes('ADMIN')`.
2. **Nova**: tabela `access_profiles` + `user_access_assignments`. Usada por `useScreenPermissions`, `useCanEdit`, `useIsAdmin`.

O `ProtectedRoute` usa `requiredRoles` que verifica **apenas a tabela legada**. Se o Tiago tem role `READONLY` na tabela legada, mas um perfil de acesso com permissões amplas, ele fica bloqueado em todas as rotas que exigem `requiredRoles={['ADMIN']}` ou `['ADMIN', 'CLOSER']`.

---

## Plano

### 1. Atualizar `ProtectedRoute` para respeitar access profiles

Remover a lógica de `requiredRoles` baseada em roles legadas. Substituir por verificação via `useScreenPermissions`:
- Adicionar prop opcional `screenKey` (chave do screen registry)
- Se `screenKey` informada, verificar `permissions[screenKey]?.view`
- Se o usuário é admin (via `useIsAdmin`), liberar sempre
- Manter `requiredRoles` apenas como fallback temporário, mas sempre liberando se `useIsAdmin()` retornar true

### 2. Migrar rotas no `App.tsx`

Trocar `requiredRoles={['ADMIN']}` por `screenKey="configuracoes"` (ou a key correspondente) em cada rota, usando o mapeamento do `SCREEN_REGISTRY`.

Exemplo:
```
// Antes
<ProtectedRoute requiredRoles={['ADMIN']}>

// Depois  
<ProtectedRoute screenKey="configuracoes">
```

### 3. Corrigir verificações diretas de role legada

| Arquivo | Trecho atual | Correção |
|---------|-------------|----------|
| `CadenceDetail.tsx` | `roles.includes('ADMIN')` | `useIsAdmin()` |
| `Atendimentos.tsx` | `hasRole('ADMIN')` | `useIsAdmin()` |
| `useScreenPermissions.ts` | `roles.includes('ADMIN')` nas funções `useCanView`/`useCanEdit` | `useIsAdmin()` (já verificado internamente) |

### Arquivos envolvidos

| Arquivo | Ação |
|---------|------|
| `src/components/auth/ProtectedRoute.tsx` | Editar — adicionar `screenKey`, integrar `useIsAdmin` + `useScreenPermissions` |
| `src/App.tsx` | Editar — trocar `requiredRoles` por `screenKey` em todas as rotas |
| `src/pages/CadenceDetail.tsx` | Editar — substituir `roles.includes('ADMIN')` por `useIsAdmin()` |
| `src/pages/Atendimentos.tsx` | Editar — substituir `hasRole('ADMIN')` por `useIsAdmin()` |

