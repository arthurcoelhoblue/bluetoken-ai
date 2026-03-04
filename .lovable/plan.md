

## Diagnóstico

Investiguei a fundo o fluxo de acesso do Tiago. O perfil dele no banco está correto: **Administrador** com `conversas: {view: true, edit: true}`. O assignment é para **TOKENIZA**.

O problema está em múltiplos pontos do código que ainda verificam `roles.includes('ADMIN')` diretamente (role legada), em vez de usar `useIsAdmin()` (que detecta admin via access profiles). Como deletamos a role `READONLY` do Tiago e ele nunca teve `ADMIN` na tabela legada, o array `roles` está **vazio**. Isso afeta:

1. **`useCanView()` e `useCanEdit()`** — usam `roles.includes('ADMIN')` como fast path. Para Tiago, esse atalho falha. Dependem então de `permissions?.[key]?.view` que deveria funcionar, mas retorna `false` enquanto o dado assíncrono não carrega.

2. **`useScreenPermissions` internamente** — define `isAdmin = roles.includes('ADMIN')` e usa isso no `queryKey`. Funciona, mas a lógica interna do `useCanView`/`useCanEdit` fica inconsistente com o `useIsAdmin()` usado no resto do app.

3. **Timing issue** — Durante o carregamento inicial, `useIsAdmin()` retorna `false` (dados não carregados), e componentes que usam `useCanView`/`useCanEdit` renderizam sem permissão. Se algum componente toma decisão irreversível baseada nesse estado inicial (redirect, hide permanente), o acesso é bloqueado.

## Plano de Correção

### 1. Atualizar `useCanView` e `useCanEdit` para usar `useIsAdmin()`

**Arquivo:** `src/hooks/useScreenPermissions.ts` (linhas 102-114)

Substituir `roles.includes('ADMIN')` por `useIsAdmin()` nos dois hooks exportados. Isso garante que qualquer usuário detectado como admin via access profiles tenha acesso imediato.

```typescript
export function useCanView(screenKey: string): boolean {
  const { data: permissions } = useScreenPermissions();
  const isAdmin = useIsAdmin();
  if (isAdmin) return true;
  return permissions?.[screenKey]?.view ?? false;
}

export function useCanEdit(screenKey: string): boolean {
  const { data: permissions } = useScreenPermissions();
  const isAdmin = useIsAdmin();
  if (isAdmin) return true;
  return permissions?.[screenKey]?.edit ?? false;
}
```

### 2. Garantir role legada mínima para usuários com access profile

Para evitar que o array `roles` vazio cause problemas em partes do código que ainda verificam roles diretamente (componentes internos, edge functions), criar uma migration que insere automaticamente uma role `CLOSER` para usuários que têm `user_access_assignments` mas nenhuma role em `user_roles`.

Isso atua como "ponte" enquanto a migração completa do sistema legado não é finalizada.

```sql
INSERT INTO user_roles (user_id, role)
SELECT DISTINCT uaa.user_id, 'CLOSER'::user_role
FROM user_access_assignments uaa
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur WHERE ur.user_id = uaa.user_id
);
```

### Arquivos envolvidos

| Arquivo | Ação |
|---------|------|
| `src/hooks/useScreenPermissions.ts` | Editar `useCanView` e `useCanEdit` — usar `useIsAdmin()` |
| Migration SQL | Inserir role `CLOSER` para usuários sem roles legadas |

