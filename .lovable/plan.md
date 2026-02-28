

# Correção do Erro ao Salvar Ramal

## Problema
O `AssignProfileDialog.tsx` faz upsert com `onConflict: 'user_id,empresa'`, mas a unique constraint real na tabela `zadarma_extensions` é `(empresa, extension_number)`. Não existe constraint unique em `(user_id, empresa)`, causando falha silenciosa no upsert.

## Solução

### Modificar `src/components/settings/AssignProfileDialog.tsx`
- Trocar a lógica de upsert por: primeiro deletar extensões existentes do usuário para as empresas selecionadas, depois inserir a nova extensão
- Isso evita conflito com a constraint real e funciona para criar ou atualizar

Lógica corrigida no `handleSave`:
```typescript
// Antes de inserir, remover extensões antigas do usuário nas empresas selecionadas
await supabase.from('zadarma_extensions')
  .delete()
  .eq('user_id', userId)
  .in('empresa', selectedEmpresas);

// Inserir nova extensão para cada empresa selecionada
if (ramal) {
  for (const emp of selectedEmpresas) {
    await supabase.from('zadarma_extensions').insert({
      user_id: userId,
      extension_number: ramal,
      empresa: emp as any,
    });
  }
}
```

