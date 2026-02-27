

## Plano: Carregar empresas dinamicamente no diálogo de criação de usuário

### Problema
O seletor de empresa em `CreateUserDialog` está hardcoded com apenas "Blue" e "Tokeniza". Empresas como "Blue Labs" e futuras não aparecem.

### Alteração

**Arquivo: `src/components/settings/CreateUserDialog.tsx`**
- Importar `useCompany` do `CompanyContext` (já usado em outros componentes)
- Usar `empresaRecords` para popular o `<Select>` dinamicamente
- Manter a opção "Todas" como primeira opção
- Substituir as linhas hardcoded 159-161 por um `.map()` sobre as empresas ativas

### Resultado
O seletor mostrará automaticamente todas as empresas ativas cadastradas na base, sem necessidade de alterações manuais ao adicionar novas empresas.

