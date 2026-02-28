

# Correção do upsert de ramais em 2 arquivos restantes

## Problema
A correção anterior só foi aplicada em `AssignProfileDialog.tsx`. Os arquivos `EditUserDialog.tsx` e `UserAccessList.tsx` ainda usam `upsert` com `onConflict: 'user_id,empresa'`, que não corresponde a nenhuma constraint real.

## Correções

### 1. `src/components/settings/EditUserDialog.tsx` (linhas 80-90)
Substituir o bloco de upsert por delete+insert:
```typescript
// Update ramal
if (data.ramal) {
  await supabase.from('zadarma_extensions').delete().eq('user_id', userId);
  const { error } = await supabase.from('zadarma_extensions').insert({
    user_id: userId,
    extension_number: data.ramal,
    empresa: 'BLUE',
  });
  if (error) throw error;
} else if (currentRamal) {
  const { error } = await supabase.from('zadarma_extensions').delete().eq('user_id', userId);
  if (error) throw error;
}
```

### 2. `src/components/settings/UserAccessList.tsx` (linhas 50-55)
Mesma abordagem de delete+insert:
```typescript
if (ramalValue) {
  await supabase.from('zadarma_extensions').delete().eq('user_id', userId);
  const { error } = await supabase.from('zadarma_extensions').insert({
    user_id: userId,
    extension_number: ramalValue,
    empresa: 'BLUE',
  });
  if (error) { toast.error('Erro ao salvar ramal'); return; }
}
```

Ambos seguem o mesmo padrão já aplicado no `AssignProfileDialog`.

