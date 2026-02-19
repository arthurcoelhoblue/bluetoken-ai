
# Plano: Corrigir duplicatas e dados do backfill

## Problemas identificados

### 1. Clientes duplicados no banco
Moschetta Padilha tem 5 registros em `cs_customers` (cada um vinculado a um contact diferente, todos com o mesmo email `tiagopadilha.adm@gmail.com`). Mario tem 2 registros com `edsonmarior@gmail.com`. O backfill preencheu apenas 1 de cada, e o usuario esta provavelmente vendo um dos duplicados vazios.

### 2. `oferta_nome` armazenando UUIDs
O backfill esta usando o `oferta_id` como `oferta_nome` quando a API do SGT retorna o UUID no campo `oferta_nome`. Precisa verificar se a API realmente retorna o nome ou o UUID, e ajustar o mapeamento.

### 3. Fontoura nao aparece na listagem
Fontoura tem dados corretos no banco (8 investimentos). Pode ser um problema de paginacao (esta na pagina 2+) ou de filtro de empresa no contexto.

## Solucao

### Etapa 1: Limpeza de duplicatas via SQL
Executar uma migration que:
- Para cada email duplicado em cs_customers da Tokeniza, mantém apenas o registro que tem mais contratos detalhados (oferta_id NOT NULL)
- Move os contratos dos registros duplicados para o registro principal (se houver)
- Deleta os registros duplicados de cs_customers

```text
Logica:
1. Identificar contacts duplicados por email+empresa
2. Para cada grupo, escolher o cs_customer com mais contratos detalhados
3. Reatribuir contratos orfaos para o customer principal
4. Deletar cs_customers duplicados
5. Deletar contacts orfaos duplicados (opcional, com cuidado)
```

### Etapa 2: Corrigir `oferta_nome` no backfill
No `sgt-backfill-investimentos/index.ts`, o campo `oferta_nome` vem diretamente do SGT. Se o SGT retorna o nome correto (como "Mineradora de Bitcoin #1"), o problema esta nos dados ja inseridos. Precisamos:
- Verificar os dados existentes onde `oferta_nome` parece um UUID
- Rodar o backfill novamente para esses clientes (resetando offset) para sobrescrever com os dados corretos da API

### Etapa 3: Garantir que Fontoura aparece
Verificar se o filtro de empresa ativa no contexto do usuario inclui TOKENIZA. O hook `useCSCustomers` filtra por `activeCompanies` do `CompanyContext` — se o usuario nao tem TOKENIZA selecionada, os clientes nao aparecem.

## Detalhes tecnicos

### Migration SQL para limpeza de duplicatas

```text
-- 1. Para cada email com multiplos cs_customers TOKENIZA,
--    manter o que tem mais contratos com oferta_id NOT NULL
-- 2. Mover contratos do duplicado para o principal
-- 3. Deletar duplicados

WITH ranked AS (
  SELECT c.id, ct.email, c.contact_id,
    (SELECT count(*) FROM cs_contracts cc 
     WHERE cc.customer_id = c.id AND cc.oferta_id IS NOT NULL) as detailed,
    ROW_NUMBER() OVER (
      PARTITION BY ct.email 
      ORDER BY (SELECT count(*) FROM cs_contracts cc 
                WHERE cc.customer_id = c.id AND cc.oferta_id IS NOT NULL) DESC,
               c.created_at ASC
    ) as rn
  FROM cs_customers c
  JOIN contacts ct ON ct.id = c.contact_id
  WHERE c.empresa = 'TOKENIZA'
),
-- Manter rn=1, deletar rn>1
-- Antes de deletar, mover contratos sem oferta_id para o principal
...
```

### Alteracao no backfill (se necessario)
Verificar se o campo `inv.oferta_nome` do SGT contem o nome legivel ou UUID. Se UUID, buscar o nome de outra forma ou manter o UUID (ja que a oferta pode nao ter nome amigavel).

## Ordem de execucao
1. Rodar a migration de limpeza de duplicatas
2. Resetar o offset do backfill e rodar novamente para corrigir `oferta_nome`
3. Verificar na UI que os 3 clientes aparecem corretamente
