

## Tornar empresas dinâmicas no AssignProfileDialog

### Problema

A lista de empresas está hardcoded na constante `AVAILABLE_EMPRESAS` (linhas 22-25), mostrando apenas BLUE e TOKENIZA. Precisa carregar da tabela `empresas` dinamicamente.

### Mudança

| Arquivo | Mudança |
|---------|---------|
| `src/components/settings/AssignProfileDialog.tsx` | Remover `AVAILABLE_EMPRESAS` hardcoded; importar `useCompany` do `CompanyContext`; usar `empresaRecords` para renderizar os checkboxes; ajustar tipos de `string[]` em vez de `('BLUE'\|'TOKENIZA')[]` |

### Detalhe

- Importar `useCompany` e usar `empresaRecords` (já carrega da tabela `empresas`)
- Remover a constante `AVAILABLE_EMPRESAS`
- Tipar `selectedEmpresas` como `string[]` em vez do union restrito
- Atualizar a prop `currentEmpresas` para `string[]`
- Renderizar checkboxes com `empresaRecords.filter(e => e.is_active)`

