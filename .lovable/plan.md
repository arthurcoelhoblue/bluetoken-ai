

## Diagnóstico: Usuários "Administrador" ficando como somente leitura

### Causa raiz

Existe uma **desconexão entre o sistema novo de perfis de acesso e o sistema legado de roles**:

- Usuários como **Roney Gustavo**, **Tayara Araújo** e **Tiago Motta** têm o perfil de acesso **"Administrador"** (com view+edit em todas as telas), mas no `user_roles` estão com a role **READONLY**.
- Várias páginas e componentes usam `hasRole('ADMIN')` diretamente (do sistema legado), que verifica a tabela `user_roles` — **não** o perfil de acesso.
- Como esses usuários têm role `READONLY`, `hasRole('ADMIN')` retorna `false`, e eles ficam sem poder editar.

**Páginas afetadas** (usam `hasRole` para decidir edição):
- `LeadDetail.tsx` → `canEdit = hasRole('ADMIN') || hasRole('CLOSER')`
- `CadenceRunDetail.tsx` → `canManage = hasRole('ADMIN') || hasRole('CLOSER')`
- `ContactIssuesCard.tsx` → `canResolve = hasRole('ADMIN') || hasRole('CLOSER')`
- `MetasPage.tsx` → `isAdmin = hasRole('ADMIN')`
- `ConversasPage.tsx` → `isAdmin = hasRole('ADMIN')`
- `AmeliaMassActionPage.tsx` → `isAdmin = hasRole('ADMIN')`
- `PendenciasPerda.tsx` → `isAdmin = hasRole('ADMIN')`

### Solução

Criar um hook `useIsAdmin()` que verifica **ambos** os sistemas: a role legada `ADMIN` **ou** o perfil de acesso "Super Admin" / "Administrador" (que tem todas as permissões como edit:true). Depois, substituir todos os `hasRole('ADMIN')` por esse hook unificado.

Concretamente:

1. **Criar `src/hooks/useIsAdmin.ts`** — hook que retorna `true` se o usuário tem role ADMIN **ou** se todas as permissões do perfil de acesso são `edit: true` (ou perfil é Super Admin).

2. **Atualizar 7 arquivos** que usam `hasRole('ADMIN')` para controlar edição, substituindo por `useIsAdmin()`:

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useIsAdmin.ts` | Novo hook que unifica verificação legada + perfil de acesso |
| `src/pages/LeadDetail.tsx` | `canEdit` usa `useIsAdmin()` |
| `src/pages/CadenceRunDetail.tsx` | `canManage` usa `useIsAdmin()` |
| `src/components/leads/ContactIssuesCard.tsx` | `canResolve` usa `useIsAdmin()` |
| `src/pages/MetasPage.tsx` | `isAdmin` usa `useIsAdmin()` |
| `src/pages/ConversasPage.tsx` | `isAdmin` usa `useIsAdmin()` |
| `src/pages/AmeliaMassActionPage.tsx` | `isAdmin` usa `useIsAdmin()` |
| `src/pages/admin/PendenciasPerda.tsx` | `isAdmin` usa `useIsAdmin()` |

O hook `useIsAdmin` reutilizará os dados já carregados por `useScreenPermissions` (cache de 5min), sem queries extras.

