

# Correções: Z-index do widget + Ramal multi-tenant + Dados do Arthur

## 1. Z-index do widget (`src/components/zadarma/ZadarmaPhoneWidget.tsx`)
Trocar `z-50` por `z-[60]` nas 4 ocorrências:
- Linha 103: FAB minimizado
- Linha 115: FAB com dial pendente  
- Linha 128: Overlay maximizado
- Linha 189: Widget expandido compacto

## 2. Ramal multi-tenant (`src/components/settings/EditUserDialog.tsx`, linhas 80-88)
Substituir insert hardcoded para BLUE por busca das empresas do usuário:
```typescript
if (data.ramal) {
  const { data: assignments } = await supabase
    .from('user_access_assignments')
    .select('empresa')
    .eq('user_id', userId);
  const empresas = [...new Set(assignments?.map(a => a.empresa) ?? [])];
  await supabase.from('zadarma_extensions').delete().eq('user_id', userId);
  for (const emp of empresas) {
    const { error } = await supabase.from('zadarma_extensions').insert({
      user_id: userId, extension_number: data.ramal, empresa: emp as any,
    });
    if (error) throw error;
  }
```

## 3. Ramal multi-tenant (`src/components/settings/UserAccessList.tsx`, linhas 50-57)
Mesma lógica: buscar empresas do usuário e inserir para todas.

## 4. Correção imediata dos dados
Inserir ramal 108 para TOKENIZA e BLUE_LABS para o Arthur (user_id `3eb15a6a-9856-4e21-a856-b87eeff933b1`), já que atualmente só existe para BLUE.

