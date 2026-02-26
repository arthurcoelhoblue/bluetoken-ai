

## Problema

O usuário Arthur (`3eb15a6a-...`) tem **zero** registros em `user_access_assignments`. Isso aconteceu porque o `useAssignProfile` faz `DELETE` de todos os assignments primeiro e depois `INSERT` dos novos. Se o INSERT falhar por qualquer motivo, o usuário fica sem acesso nenhum.

## Correção

### 1. Restaurar dados imediatamente (SQL insert)

Inserir assignments do Arthur para BLUE, TOKENIZA e BLUE_LABS com o perfil "Super Admin" (`d82ee44c-2c33-4a05-99be-2cf5451018d4`).

### 2. Corrigir `useAssignProfile` no código

**Arquivo**: `src/hooks/useAccessControl.ts`

Mudar a lógica para ser mais segura:
- Primeiro fazer o INSERT dos novos registros
- Só depois deletar os antigos que não estão na nova lista
- Ou usar abordagem de upsert + cleanup

```typescript
// Ao invés de DELETE ALL + INSERT:
// 1. Insert novos (ON CONFLICT DO NOTHING)
// 2. Delete apenas os que não estão na lista nova
const { error: delErr } = await supabase
  .from('user_access_assignments')
  .delete()
  .eq('user_id', payload.user_id)
  .not('empresa', 'in', `(${payload.empresas.join(',')})`);

// Upsert novos
for (const empresa of payload.empresas) {
  await supabase.from('user_access_assignments').upsert({
    user_id: payload.user_id,
    access_profile_id: payload.access_profile_id,
    empresa,
  }, { onConflict: 'user_id,empresa' });
}
```

