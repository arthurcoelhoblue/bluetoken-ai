
# Implementacao da Tela de Contatos

## Objetivo
Transformar a pagina `/contatos` de um placeholder em uma tela funcional com listagem em tabela, busca por texto, filtros por empresa/tipo/cliente, dialog para criar novo contato e vinculacao com organizacao.

## Funcionalidades

### 1. Listagem em Tabela
- Tabela com colunas: Nome, Email, Telefone, Empresa, Tipo, Organizacao, Cliente, Tags, Criado em
- Ordenacao padrao por nome
- Limite de 200 registros (ja definido no hook)
- Badge de empresa (BLUE/TOKENIZA) e badge "Cliente" quando `is_cliente = true`

### 2. Busca
- Campo de busca por nome, email ou telefone (ja implementado no `useContacts`)
- Busca ativada ao pressionar Enter ou clicar no botao

### 3. Filtros
- **Empresa**: Filtrado automaticamente pelo CompanyContext (ja existe)
- **Tipo**: LEAD, CLIENTE, PARCEIRO etc (campo `tipo` da tabela)
- **Cliente**: Sim/Nao (campo `is_cliente`)
- Botao "Limpar filtros"

### 4. Criar Novo Contato (Dialog)
- Campos: nome (obrigatorio), primeiro_nome, sobrenome, email, telefone, empresa (select), organization_id (select buscando do hook `useOrganizations`), tipo, tags
- Usar `useCreateContact` ja existente (sera expandido para aceitar os novos campos)

### 5. Linha clicavel
- Clicar em uma linha abre o detalhe do contato (futura pagina `/contatos/:id`, por ora nao navega mas ja deixa preparado)

## Detalhes Tecnicos

### Arquivos alterados

1. **`src/pages/ContatosPage.tsx`** — Reescrita completa:
   - Importar `useContacts` e componentes de UI (Table, Input, Select, Dialog, Badge, Button, Tooltip)
   - Estado local para `search`, `tipoFilter`, `isClienteFilter`
   - Passar `search` para `useContacts` (hook ja suporta)
   - Filtrar localmente por `tipo` e `is_cliente` (campos nao estao no hook, filtramos client-side)
   - Dialog de criacao usando form controlado
   - Seguir mesmo padrao visual de `LeadsList.tsx` (header com icone, Card de busca/filtros, Card com tabela)

2. **`src/hooks/useContacts.ts`** — Expandir `useCreateContact`:
   - Aceitar campos adicionais: `primeiro_nome`, `sobrenome`, `cpf`, `organization_id`, `tipo`, `tags`
   - Inserir todos os campos no insert

### Padrao de UI
- Mesmo layout do `LeadsList.tsx`: header com icone gradiente, Card de busca, Card com tabela
- Tooltips em todos os botoes de acao (padrao ja adotado no projeto)
- `TooltipProvider` envolvendo o conteudo
- Skeleton/spinner durante loading
- Mensagem de "Nenhum contato encontrado" quando lista vazia

### Nenhuma migracao de banco necessaria
A tabela `contacts` ja possui todos os campos necessarios (nome, email, telefone, empresa, tipo, is_cliente, organization_id, tags, cpf, etc.)
