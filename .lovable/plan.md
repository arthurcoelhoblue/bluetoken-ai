

# Adaptacao do CS para Tokeniza - Investimentos

## Contexto

O modulo de CS foi construido com logica de Blue (contratos anuais, renovacao, MRR mensal). Na Tokeniza o modelo e diferente: clientes fazem investimentos em ofertas (crowdfunding), e o que importa e **LTV total**, **ticket medio**, **constancia de aportes** e **tempo desde o ultimo investimento** como indicador de churn.

## O que muda

### 1. Metricas da Sidebar e Dashboard (condicionais por empresa)

Quando `empresa === 'TOKENIZA'`:
- **"MRR"** vira **"Total Investido"** (soma de todos os `cs_contracts.valor`)
- **"Renovacao"** vira **"Ultimo Investimento"** (data do investimento mais recente)
- Adicionar **"Ticket Medio"** (total investido / numero de investimentos)
- Adicionar **"Qtd Investimentos"** (total de registros em `cs_contracts`)
- Remover o KPI "Renovacoes 30d" e substituir por **"Inativos >90d"** (clientes cujo ultimo investimento foi ha mais de 90 dias)

### 2. Colunas da tabela de listagem (CSClientesPage)

Quando Tokeniza esta selecionada:
- Coluna "MRR" vira "Total Investido"
- Coluna "Renovacao" vira "Ultimo Investimento"
- Adicionar coluna "Ticket Medio"

### 3. Filtros da listagem

Substituir os filtros de renovacao quando empresa e TOKENIZA:
- **"Investido de" / "Ate"**: filtra pelo campo `data_contratacao` dos contratos (periodo em que o investimento foi feito)
- **"Oferta"**: dropdown com as ofertas disponiveis (distinct `oferta_nome` da tabela `cs_contracts` para TOKENIZA)
- **"Inativo ha"**: selecionar tiers de inatividade (>90 dias, >180 dias, >365 dias) baseado na data do ultimo investimento

### 4. Tiers de inatividade e Churn

Adicionar campo calculado ou coluna `dias_sem_investir` baseado na data do ultimo `cs_contracts.data_contratacao`:
- **90+ dias**: Alerta amarelo - "Sem investir ha X dias"
- **180+ dias**: Alerta laranja
- **365+ dias**: Considerar como **churn/inativo**, atualizar `is_active = false` automaticamente

### 5. Aba "Renovacao" vira "Aportes" para Tokeniza

No `CSClienteDetailPage`, a tab "Renovacao" para TOKENIZA deve:
- Renomear para "Aportes"
- Remover logica de elegibilidade de 9 meses
- Mostrar: timeline de todos investimentos, total investido, ticket medio, dias desde ultimo aporte
- Alertas de inatividade (90d, 180d, 365d)

### 6. Dashboard KPIs condicionais

No `CSDashboardPage` e `useCSMetrics`:
- Quando so TOKENIZA selecionada: trocar "Renovacoes 30d" por "Inativos >90d"
- "Churn Rate" baseado em clientes com >365 dias sem investir
- Card "Projecao de Receita" adaptar labels (nao e MRR, e volume investido)

### 7. Resolver `oferta_nome` com UUIDs

Dos 1456 contratos Tokeniza, 677 tem `oferta_nome` como UUID. O problema e que o SGT retorna UUID no campo `oferta_nome` para ofertas antigas. Solucao:
- Criar uma tabela de mapeamento ou atualizar os registros existentes com nomes corretos quando disponiveis
- No filtro de ofertas, mostrar apenas ofertas com nome legivel (excluir UUIDs e "TEMP")

## Detalhes tecnicos

### Alteracoes de banco de dados

Nenhuma migration necessaria. Todos os dados ja existem em `cs_contracts` (valor, data_contratacao, oferta_nome, oferta_id). Os calculos de LTV, ticket medio e dias sem investir serao feitos em queries ou no frontend.

### Arquivos a alterar

1. **`src/pages/cs/CSClientesPage.tsx`**
   - Detectar empresa ativa via `useCompany()`
   - Condicionar colunas da tabela (MRR vs Total Investido, Renovacao vs Ultimo Investimento)
   - Condicionar filtros (renovacao vs periodo de investimento + oferta + inatividade)
   - Buscar lista de ofertas distintas para dropdown

2. **`src/hooks/useCSCustomers.ts`**
   - Adicionar filtros: `investimento_de`, `investimento_ate`, `oferta_nome`, `dias_inativo_min`
   - Para filtro de oferta e periodo de investimento, fazer sub-query em `cs_contracts`
   - Para inatividade, calcular max(`data_contratacao`) e filtrar

3. **`src/types/customerSuccess.ts`**
   - Adicionar campos ao `CSCustomerFilters`: `investimento_de`, `investimento_ate`, `oferta_nome`, `dias_inativo_min`
   - Adicionar ao `CSMetrics`: `inativos_90d`, `total_investido`, `ticket_medio`

4. **`src/hooks/useCSMetrics.ts`**
   - Quando empresa inclui TOKENIZA, calcular metricas especificas (inativos, LTV, ticket medio)
   - Buscar dados de `cs_contracts` para agregar totais

5. **`src/pages/cs/CSClienteDetailPage.tsx`**
   - Sidebar: labels condicionais (MRR vs Total Investido, Renovacao vs Ultimo Aporte)
   - Tab "Renovacao" renomeada para "Aportes" quando TOKENIZA
   - Metricas adicionais: ticket medio, qtd investimentos, dias desde ultimo aporte

6. **`src/components/cs/CSRenovacaoTab.tsx`**
   - Quando empresa TOKENIZA: layout diferente focado em aportes
   - Timeline de investimentos (ja existe via contratos)
   - Cards: total investido, ticket medio, ultimo aporte, dias sem investir
   - Alertas por tier de inatividade (90d, 180d, 365d)

7. **`src/pages/cs/CSDashboardPage.tsx`**
   - KPI "Renovacoes 30d" condicional: vira "Inativos >90d" para Tokeniza
   - Label "MRR" condicional no card de churn risk

8. **`src/components/cs/CSRevenueCard.tsx`**
   - Labels condicionais: "MRR" vira "Volume Investido" para Tokeniza
   - "Projecao" vira "Volume em Risco"

### Hook auxiliar novo: `useCSTokenizaMetrics`

Para calcular metricas especificas de Tokeniza por cliente:

```text
Query: SELECT customer_id, 
  SUM(valor) as total_investido,
  COUNT(*) as qtd_investimentos,
  AVG(valor) as ticket_medio,
  MAX(data_contratacao) as ultimo_investimento
FROM cs_contracts
WHERE empresa = 'TOKENIZA'
GROUP BY customer_id
```

Este hook sera usado tanto na listagem quanto no detalhe.

### Logica de filtro por oferta

```text
1. Buscar ofertas distintas: SELECT DISTINCT oferta_nome FROM cs_contracts 
   WHERE empresa = 'TOKENIZA' AND oferta_nome IS NOT NULL 
   AND oferta_nome NOT LIKE '%-%-%-%' (excluir UUIDs)
   AND oferta_nome != 'TEMP'
2. Popular dropdown de filtro
3. Ao filtrar, buscar customer_ids com contratos dessa oferta
```

### Logica de filtro por inatividade

```text
1. Calcular ultimo investimento por customer:
   SELECT customer_id, MAX(data_contratacao) as ultimo
   FROM cs_contracts WHERE empresa = 'TOKENIZA'
   GROUP BY customer_id
   HAVING MAX(data_contratacao) < NOW() - INTERVAL 'X days'
2. Retornar lista de customer_ids para filtrar
```

## Ordem de execucao

1. Atualizar types (`CSCustomerFilters`, `CSMetrics`)
2. Criar hook `useCSTokenizaMetrics` e query de ofertas
3. Atualizar `useCSCustomers` com novos filtros
4. Atualizar `useCSMetrics` com metricas condicionais
5. Atualizar `CSClientesPage` (colunas + filtros condicionais)
6. Atualizar `CSClienteDetailPage` (sidebar + tab rename)
7. Atualizar `CSRenovacaoTab` para modo Aportes
8. Atualizar dashboard e revenue card com labels condicionais

