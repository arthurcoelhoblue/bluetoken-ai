

## Problema

O hook `useScreenPermissions.ts` busca a atribuição do usuário com `.maybeSingle()`:

```typescript
const { data: assignment } = await supabase
  .from('user_access_assignments')
  .select('access_profile_id, permissions_override')
  .eq('user_id', user!.id)
  .maybeSingle();
```

Douglas tem 3 linhas em `user_access_assignments` (uma por empresa). O `.maybeSingle()` retorna erro quando há mais de 1 resultado, fazendo `assignment = null`. Como sua role é READONLY (não ADMIN), ele cai no fallback legado que só libera `dashboard:read`.

## Correção

**`src/hooks/useScreenPermissions.ts`**: trocar `.maybeSingle()` por `.limit(1).maybeSingle()` para pegar a primeira atribuição válida.

Além disso, seria prudente também alterar a role do Douglas de READONLY para ADMIN no banco, já que ele é super administrador. Mas a correção do `.limit(1)` resolve o problema imediato para qualquer usuário com múltiplas empresas.

| Arquivo | Mudança |
|---------|---------|
| `useScreenPermissions.ts` | Adicionar `.limit(1)` antes de `.maybeSingle()` |
| Banco (SQL) | Atualizar role do Douglas de READONLY para ADMIN |

