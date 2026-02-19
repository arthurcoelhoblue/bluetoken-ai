
# Resolver Nomes de Ofertas Ausentes nos Investimentos Tokeniza

## Diagnóstico

Há **614 investimentos** onde `oferta_nome` foi gravado com o próprio `oferta_id` (UUID), e **63** sem nome algum. Isso afeta diversas ofertas históricas (principalmente de 2024), onde o SGT não retornava o campo `oferta_nome` preenchido nas versões antigas da API.

O investimento do Ronaldo de 21/01/2025 (R$ 10.000, oferta `62288bba-d90a-11ef-aaa1-06aff79fa023`) é um desses casos.

## O que será feito

### 1. Tela de Mapeamento de Ofertas (nova página de administração)

Criar uma nova aba/seção em Configurações de CS (ou acessível via menu Admin) chamada **"Ofertas Tokeniza"**, que exibirá:

- Lista de todas as ofertas com `oferta_nome = oferta_id` (sem nome real), com:
  - `oferta_id`
  - Qtd de clientes afetados
  - Volume total
  - Período (datas)
  - Campo de input para digitar o nome correto

- Botão **"Salvar e Aplicar"** que executa um `UPDATE` em massa em `cs_contracts` para todos os registros com aquele `oferta_id`

### 2. Correção visual imediata no `CSAportesTab`

Enquanto não há nome mapeado, em vez de exibir o UUID bruto, exibir:
- `"Oferta ID: 62288b…"` (truncado) com badge `Sem nome`

Isso melhora imediatamente a legibilidade sem precisar esperar o mapeamento.

### 3. Arquivos alterados

**`src/components/cs/CSAportesTab.tsx`**:
- Função auxiliar `displayNomeOferta(ct)`:
  - Se `oferta_nome` for igual a `oferta_id` ou for UUID puro → exibe `"Oferta sem nome"` + badge com ID truncado
  - Caso contrário → exibe o nome normalmente

**`src/pages/admin/CSOfertasPage.tsx`** _(novo arquivo)_:
- Tabela com todas as ofertas sem nome (`oferta_nome = oferta_id`)
- Cada linha tem um `Input` para digitar o nome correto
- Botão "Aplicar" por linha executa `UPDATE cs_contracts SET oferta_nome = ?, plano = ? WHERE oferta_id = ?`
- Usa `useQuery` + `useMutation` do TanStack Query

**`src/hooks/useCSOfertaMapping.ts`** _(novo arquivo)_:
- `useCSOfertasSemNome()` → busca todas as ofertas distintas onde `oferta_nome = oferta_id`
- `useUpdateOfertaNome()` → mutation para aplicar o nome por `oferta_id` em massa

**Rota e navegação**:
- Adicionar rota `/cs/admin/ofertas` no router
- Adicionar link no menu de CS (visível para admins)

## Resultado imediato

- O investimento do Ronaldo de 21/01/2025 passará a exibir `"Oferta sem nome [62288b…]"` em vez do UUID completo
- Você poderá abrir a tela de mapeamento e digitar o nome correto (ex: "Renda Fixa Tokeniza Jan/25"), e todos os 614 contratos afetados serão corrigidos com um clique por oferta
