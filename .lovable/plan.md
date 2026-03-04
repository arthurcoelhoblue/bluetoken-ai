

## Diagnóstico

O problema é claro: existem **dois sistemas de permissão** no código, e eles estão em conflito.

1. **Sistema legado** — tabela `user_roles` com roles como `READONLY`, `CLOSER`, `ADMIN`
2. **Sistema novo** — tabela `access_profiles` + `user_access_assignments` (os "grupos" que você configurou)

O hook `useScreenPermissions` usa corretamente o sistema novo (perfis de acesso). Porém, **vários componentes ainda verificam o sistema legado** diretamente com `hasRole('CLOSER')` ou `roles.includes('ADMIN')`.

Resultado: mesmo que o Rodrigo esteja no grupo "Closer" com todas as permissões liberadas, o código verifica `hasRole('CLOSER')` na tabela `user_roles` — onde ele tem `READONLY`. Isso torna ele somente leitura em várias telas.

## Correção

Substituir todas as verificações legadas (`hasRole('CLOSER')`, `roles.includes('ADMIN')`) pelas funções do sistema novo de perfis de acesso.

### Arquivos afetados

**Críticos (causam o comportamento "somente leitura"):**

| Arquivo | Código atual | Substituição |
|---------|-------------|-------------|
| `src/pages/LeadDetail.tsx` | `isAdmin \|\| hasRole('CLOSER')` | `useCanEdit('contatos')` |
| `src/pages/CadenceRunDetail.tsx` | `isAdmin \|\| hasRole('CLOSER')` | `useCanEdit('leads_cadencia')` |
| `src/components/leads/ContactIssuesCard.tsx` | `isAdmin \|\| hasRole('CLOSER')` | `useCanEdit('contatos')` |

**Alinhamento admin (usar `useIsAdmin()` unificado):**

| Arquivo | Código atual | Substituição |
|---------|-------------|-------------|
| `src/pages/PipelinePage.tsx` | `roles.includes('ADMIN')` | `useIsAdmin()` |
| `src/pages/CadencesList.tsx` | `roles.includes('ADMIN')` | `useIsAdmin()` |
| `src/pages/CadenceDetail.tsx` | `roles.includes('ADMIN')` | `useIsAdmin()` |
| `src/components/layout/AppSidebar.tsx` | `roles.includes('ADMIN')` | `useIsAdmin()` |
| `src/components/settings/EditUserDialog.tsx` | `roles.includes('ADMIN')` | `useIsAdmin()` |

### Resultado esperado

Após a mudança, as permissões do usuário serão determinadas **exclusivamente pelo perfil de acesso atribuído** (o grupo). Se o Rodrigo está no grupo "Closer" com edição liberada em Pipeline, Contatos, Cadências etc., ele terá acesso de edição nessas telas — independente do que está na tabela `user_roles`.

