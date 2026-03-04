

## Avaliação: Onde cadastrar produtos do catálogo

Existem **duas tabelas diferentes** no sistema:
- `product_knowledge` — conceito do produto para a IA (Base de Conhecimento, `/admin/produtos`)
- `catalog_products` — produto comercial com preço, usado em deals/orçamentos

A tabela `catalog_products` já existe no banco (campos: `nome`, `descricao`, `preco_unitario`, `unidade`, `empresa`, `ativo`) mas **não tem interface de cadastro**. Só é consumida no DealProductsTab.

**Minha recomendação: dentro de AdminEmpresas.** Motivos:
1. Produto comercial pertence à empresa, não à base de conhecimento da IA
2. O fluxo natural é: abrir empresa → ver/gerenciar seus produtos
3. Evita confusão entre "treinar a IA" e "cadastrar preço de produto"

---

## Plano de implementação

### Criar componente `EmpresaProductsCatalog`

Componente que recebe `empresaId` e renderiza:
- Lista de `catalog_products` filtrados por empresa
- Formulário inline para adicionar produto (nome, descrição, preço unitário, unidade)
- Botão editar/excluir em cada produto
- Toggle ativo/inativo por produto

### Integrar no AdminEmpresas

Quando o usuário clicar no botão de editar uma empresa, o dialog atual será expandido com **duas abas** (usando Tabs do Radix):
- **Dados** — formulário atual de edição (nome, cor)
- **Produtos** — o novo componente `EmpresaProductsCatalog`

O dialog ganha `max-w-2xl` para acomodar a lista de produtos.

### Arquivos envolvidos

| Arquivo | Ação |
|---------|------|
| `src/components/admin/EmpresaProductsCatalog.tsx` | Novo — CRUD de catalog_products por empresa |
| `src/pages/AdminEmpresas.tsx` | Editar — adicionar Tabs no dialog de edição |

Nenhuma migração necessária — a tabela `catalog_products` já existe com a estrutura correta.

