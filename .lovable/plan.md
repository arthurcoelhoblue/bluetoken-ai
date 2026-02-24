

## Corrigir Alucinação de Planos/Preços pela Amélia

### Problema

A Amélia está inventando planos e preços inexistentes (ex: "Plano Starter R$ 297") porque:
1. A query de produtos usa colunas erradas (`nome, preco_texto, diferenciais`) que nao existem na tabela `product_knowledge` (colunas reais: `produto_nome, descricao_curta`)
2. O prompt nao tem instrucao proibindo a IA de inventar informacoes
3. A tabela `product_knowledge` da Blue tem apenas 1 registro generico sem planos/precos detalhados

### Solucao em 3 partes

#### 1. Corrigir a query de produtos no response-generator.ts

A query atual:
```
.select('nome, descricao_curta, preco_texto, diferenciais')
```

Precisa ser corrigida para usar as colunas reais da tabela:
```
.select('produto_nome, descricao_curta')
```

E ajustar o `ProductRow` e o mapeamento para `productsText`.

#### 2. Adicionar instrucao anti-alucinacao no system prompt

Adicionar ao system prompt padrao (e como regra geral):
```
PROIBIDO INVENTAR: Nunca cite planos, precos, valores ou produtos que nao estejam listados na secao PRODUTOS. Se nao souber o preco ou plano exato, diga que vai verificar com a equipe.
```

#### 3. Enriquecer a tabela product_knowledge com dados reais

Adicionar colunas `preco_texto` e `diferenciais` na tabela `product_knowledge` para que os planos reais da Blue possam ser cadastrados e injetados no prompt. Isso evita que a IA precise "adivinhar".

### Detalhes Tecnicos

**Arquivo: `supabase/functions/sdr-ia-interpret/response-generator.ts`**

- Corrigir a interface `ProductRow` para refletir colunas reais: `produto_nome` em vez de `nome`
- Corrigir a query `.select(...)` para usar `produto_nome, descricao_curta`
- Atualizar o mapeamento em `productsText` para usar `p.produto_nome`
- Adicionar ao system prompt (linha 180): instrucao clara proibindo inventar planos, precos ou informacoes nao fornecidas
- Adicionar ao prompt do usuario (linha 207): reforco de que se os produtos listados nao tiverem preco, a Amelia deve dizer que vai confirmar com a equipe

**Migration SQL**

Adicionar colunas opcionais `preco_texto` e `diferenciais` na tabela `product_knowledge`:
```sql
ALTER TABLE product_knowledge ADD COLUMN IF NOT EXISTS preco_texto TEXT;
ALTER TABLE product_knowledge ADD COLUMN IF NOT EXISTS diferenciais TEXT;
```

### Resultado Esperado

- Amelia nunca mais inventa planos ou precos
- Se nao tiver dados de produto suficientes, ela diz "vou verificar com a equipe"
- Quando os planos reais forem cadastrados na tabela, a Amelia os utiliza corretamente

### Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/sdr-ia-interpret/response-generator.ts` | Corrigir query, prompt e tipos |
| Migration SQL | Adicionar colunas `preco_texto` e `diferenciais` |

