

## Plano: Permitir edição de perfis e garantir Super Admin com acesso total

### Problemas identificados

1. **AccessProfileEditor**: a variável `isReadOnly = profile?.is_system` bloqueia edição de todos os perfis de sistema — como todos os perfis atuais são `is_system`, nenhum pode ser editado
2. **Douglas Chaves** não tem nenhuma atribuição de acesso (nem perfil Super Admin)
3. O hook `useScreenPermissions` só bypassa para role ADMIN; quem tem perfil "Super Admin" via `access_profiles` não recebe bypass automático

### Mudanças

**1. `src/components/settings/AccessProfileEditor.tsx`**
- Remover bloqueio `isReadOnly` para perfis `is_system` — permitir que admins editem as permissões
- Manter apenas o nome e descrição bloqueados para o perfil "Super Admin" (para proteger o perfil raiz)
- Permissões do Super Admin também editáveis? Não — Super Admin deve ser sempre 100%, então manter as permissões bloqueadas apenas para esse perfil específico

**2. `src/hooks/useScreenPermissions.ts`**
- Adicionar verificação: se o `access_profile_id` do usuário é o Super Admin (`d82ee44c-...`), conceder acesso total (view+edit em todas as telas), sem depender da role ADMIN

**3. Dados: atribuir Super Admin a Douglas**
- Inserir `user_access_assignments` para Douglas com perfil Super Admin em todas as empresas que ele precisa acessar

### Detalhes

| Arquivo | Mudança |
|---------|---------|
| `AccessProfileEditor.tsx` | `isReadOnly` só bloqueia o perfil "Super Admin" (nome=Super Admin), outros `is_system` ficam editáveis |
| `useScreenPermissions.ts` | Checar se profile assignment é Super Admin → full access |
| Dados (insert) | Atribuir Douglas ao perfil Super Admin |

