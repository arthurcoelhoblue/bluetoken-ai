

## Botao "Editar Contato" na tela do Lead

### O que sera feito

Adicionar um botao "Editar Contato" ao lado do botao "Editar Classificacao" no header da pagina de detalhe do lead. Ao clicar, abre um modal (Dialog) onde o usuario pode editar os dados do contato: nome, primeiro nome, email, telefone, CPF, tipo, canal de origem e notas.

### Arquitetura

O lead detail usa a tabela `lead_contacts`, mas os campos ricos (CPF, tipo, canal_origem, notas) vivem na tabela `contacts` (vinculada via `legacy_lead_id`). O modal vai:

1. Buscar o registro na tabela `contacts` usando `legacy_lead_id = lead_id`
2. Exibir os campos para edicao
3. Salvar via UPDATE na tabela `contacts`
4. Apos salvar, dar refetch nos dados do lead

### Campos editaveis no modal

- Nome completo
- Primeiro nome
- Email
- Telefone
- CPF (com validacao)
- Tipo (LEAD, CLIENTE, PARCEIRO, FORNECEDOR, OUTRO)
- Canal de origem
- Notas

### Arquivos afetados

1. **Novo: `src/components/leads/EditContactModal.tsx`**
   - Dialog com formulario usando react-hook-form + zod (reutilizando `contactCreateSchema` adaptado)
   - Busca dados atuais do `contacts` via `legacy_lead_id`
   - Salva via `supabase.from('contacts').update(...)`
   - Segue mesmo padrao visual do `EditClassificationModal`

2. **Editar: `src/pages/LeadDetail.tsx`**
   - Importar `EditContactModal`
   - Adicionar estado `editContactOpen`
   - Adicionar botao "Editar Contato" com icone `UserPen` ao lado do botao de classificacao
   - Renderizar o modal no final do componente

### Detalhes tecnicos

- O modal recebe `leadId` e `empresa` como props
- Ao abrir, faz query em `contacts` WHERE `legacy_lead_id = leadId` para pre-popular o form
- Validacao com schema zod similar ao `contactCreateSchema` existente
- Permissao: mesmo `canEdit` ja usado (ADMIN ou CLOSER)
- Apos salvar com sucesso, chama `onSuccess` que faz refetch dos dados do lead
