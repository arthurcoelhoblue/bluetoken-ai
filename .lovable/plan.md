

## Correções: Templates por número dentro da empresa

### Problemas identificados

1. **TemplateFormDialog**: Quando troca a empresa, o `connectionId` não é resetado — pode mostrar número da Blue ao criar template da Tokeniza
2. **TemplatesPage**: O filtro de conexão usa `activeCompanies[0]` fixo, não respeita a empresa específica dos templates na lista
3. Não há ação para "submeter template aprovado para outro número" na mesma empresa
4. Não há coluna "Número" na tabela para identificar a qual conexão o template pertence

### Mudanças

**1. `TemplateFormDialog.tsx`**
- Resetar `connectionId` quando `empresa` muda (via `useEffect` observando `empresa`)
- Carregar empresas da tabela `empresas` dinamicamente (substituir hardcoded BLUE/TOKENIZA/MPUPPE/AXIA)

**2. `TemplatesPage.tsx`**
- O filtro de conexão deve usar a empresa ativa do contexto do CompanyContext (já funciona com `activeCompanies[0]`)
- Adicionar coluna "Número" na tabela que mostra o label/phone da conexão vinculada ao template
- Adicionar ação "Duplicar para outro número" em templates APPROVED + WhatsApp: abre um mini-dialog com ConnectionPicker da mesma empresa, cria cópia LOCAL com o novo `connection_id`
- Para resolver o label do número na tabela, fazer um lookup das connections por empresa

**3. `useTemplates.ts`**
- Nenhuma mudança estrutural necessária — já filtra por `connectionId` e `activeCompanies`

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `src/components/templates/TemplateFormDialog.tsx` | Reset connectionId ao trocar empresa; empresas dinâmicas |
| `src/pages/TemplatesPage.tsx` | Coluna "Número"; ação "Duplicar para outro número"; lookup de connections |

