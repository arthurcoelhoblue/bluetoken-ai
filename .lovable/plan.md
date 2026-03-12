## Plano: Centralizar Cadastro de Produtos nas Configurações

### Situação atual

- Produtos são cadastrados dentro da gestão de empresas (`AdminEmpresas` → aba "Produtos")
- Tabela `catalog_products` tem: nome, descricao, preco_unitario, unidade, empresa, ativo
- No Deal, o vendedor pode digitar produto manualmente OU selecionar do catálogo

### O que muda

**1. Banco de dados** — Adicionar coluna `frequencia_cobranca` na `catalog_products`

Valores: `uma_vez`, `mensal`, `trimestral`, `semestral`, `anual` (default: `uma_vez`)

**2. Nova aba "Produtos" nas Configurações** (`Settings.tsx`)

- Nova aba com ícone `Package` entre "Comercial" e "IA"
- Componente `ProductsCatalogTab` com CRUD completo:
  - Lista todos os produtos (filtráveis por empresa)
  - Formulário: Nome, Descrição, Preço unitário, Frequência de cobrança, Visibilidade por empresa
  - Toggle ativo/inativo, editar, excluir
- Grid de cols ajustado de 5 para 6 abas

**3. Simplificar aba Produtos no Deal** (`DealProductsTab`)

- Remover campos manuais de nome/preço — o vendedor seleciona obrigatoriamente do catálogo
- Após selecionar, exibe o produto com preço/frequência pré-preenchidos
- Campos editáveis apenas: preço unitário (ajuste manual), quantidade e desconto (pode ser em % ou valor)
- Mostrar a frequência de cobrança ao lado do preço na lista de produtos do deal

**4. Remover catálogo da página de Empresas**

- Remover a aba "Produtos" de `AdminEmpresas.tsx` e a importação do `EmpresaProductsCatalog`

### Arquivos


| Arquivo                                          | Ação                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Migration SQL                                    | Adicionar coluna `frequencia_cobranca TEXT DEFAULT 'uma_vez'` em `catalog_products` |
| `src/components/settings/ProductsCatalogTab.tsx` | **Novo** — CRUD centralizado de produtos                                            |
| `src/pages/admin/Settings.tsx`                   | Adicionar aba "Produtos"                                                            |
| `src/components/deals/DealProductsTab.tsx`       | Simplificar — seleção obrigatória do catálogo, apenas ajustes manuais               |
| `src/hooks/useDealProducts.ts`                   | Atualizar interface `CatalogProduct` com `frequencia_cobranca`                      |
| `src/pages/AdminEmpresas.tsx`                    | Remover aba Produtos e import do `EmpresaProductsCatalog`                           |


### Estrutura visual — Settings → Produtos

```text
┌─────────────────────────────────────────────┐
│ [+ Novo Produto]              Filtro: Todos │
├─────────────────────────────────────────────┤
│ 📦 Plano Premium                           │
│    R$ 999,00 / mensal  •  BLUE, AMELIA      │
│                        [✏️] [🗑️] [toggle]   │
├─────────────────────────────────────────────┤
│ 📦 Setup Inicial                            │
│    R$ 2.500,00 / uma vez  •  BLUE           │
│                        [✏️] [🗑️] [toggle]   │
└─────────────────────────────────────────────┘
```

### Estrutura visual — Deal → Aba Produtos (simplificada)

```text
┌─ Selecionar produto ──────────────────────┐
│ [Select: Plano Premium — R$ 999/mensal ▼] │
│ Preço: [999,00]  Qtd: [1]  Desc%: [0]     │
│                           [Adicionar]      │
└───────────────────────────────────────────┘
```