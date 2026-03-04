

## Diagnóstico: 3 lacunas de integração

Atualmente o sistema tem **dois mundos separados** que não se falam:

1. **`catalog_products`** — cadastro comercial (nome, preço, unidade, empresa). Usado apenas no `DealProductsTab` para montar itens de negócio. Não tem proposta comercial e não alimenta a IA.

2. **`product_knowledge`** — base de conhecimento da IA (produto_nome, descricao_curta, preco_texto, diferenciais). Usado pelo `sdr-ia-interpret` para a Amélia responder sobre produtos. Não está conectado ao catálogo comercial.

3. **Proposta comercial** — não existe no sistema. Quando o usuário adiciona produtos ao deal, não há como gerar/visualizar uma proposta formatada.

---

## Plano

### 1. Sincronizar catálogo comercial com a Amélia

Alterar o `response-generator.ts` e o `intent-classifier.ts` para, além de consultar `product_knowledge`, também carregar `catalog_products` ativos da empresa. Isso garante que a Amélia tenha acesso a preços reais, descrições e unidades do catálogo.

No fallback de produtos do response-generator (linha ~308), adicionar query a `catalog_products` e mesclar com `product_knowledge`:

```
const { data: catalogItems } = await supabase.from('catalog_products')
  .select('nome, descricao, preco_unitario, unidade')
  .eq('empresa', empresa).eq('ativo', true);
```

E formatar para o prompt: `### {nome}\n{descricao}\nPreço: R$ {preco_unitario}/{unidade}`

Mesma lógica no `intent-classifier.ts` na função `fetchProductKnowledge`.

### 2. Vincular `catalog_products` ↔ `product_knowledge`

Adicionar coluna `catalog_product_id` (FK opcional) na tabela `product_knowledge` via migração. Isso permite que ao cadastrar um produto no catálogo, ele possa ser referenciado pela base de conhecimento da IA, e vice-versa. A Amélia usa ambos: dados conceituais de `product_knowledge` + preços reais de `catalog_products`.

### 3. Gerar proposta comercial a partir do deal

Criar componente `DealProposalGenerator` que, dado um deal com produtos (`deal_products`), gera uma proposta formatada com:
- Dados do contato/organização
- Lista de produtos com preço, quantidade, desconto
- Total
- Botão para copiar/exportar (PDF via window.print ou clipboard)

Integrar como botão "Gerar Proposta" na aba Produtos do `DealDetailSheet`.

### Arquivos envolvidos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/sdr-ia-interpret/response-generator.ts` | Editar — adicionar query a `catalog_products` no fallback |
| `supabase/functions/sdr-ia-interpret/intent-classifier.ts` | Editar — incluir `catalog_products` em `fetchProductKnowledge` |
| `src/components/deals/DealProposalGenerator.tsx` | Novo — gerador de proposta comercial |
| `src/components/deals/DealProductsTab.tsx` | Editar — adicionar botão "Gerar Proposta" |
| Migração SQL | Adicionar `catalog_product_id` em `product_knowledge` (opcional) |

### Sem migração obrigatória

A conexão IA ↔ catálogo pode funcionar sem FK, buscando ambas as tabelas por empresa. A FK é um refinamento opcional para quando o admin quiser vincular explicitamente um registro de conhecimento a um produto do catálogo.

