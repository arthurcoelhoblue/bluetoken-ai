

# Implementação do Dashboard de Resolução Autônoma (Item 6 — componente React pendente)

A view SQL `amelia_resolution_stats` já está criada e populada com dados reais. Falta apenas o componente React e a integração na página da Amélia.

---

## Arquivos a criar

### 1. `src/hooks/useResolutionStats.ts`
- Hook que consulta a view `amelia_resolution_stats` filtrando por `activeCompanies`
- Agrega totais: conversas, resolvidas autonomamente, escaladas, taxa média de resolução (%)
- Retorna `dailyStats` (últimos 30 dias) + resumo agregado
- Refresh automático a cada 60s

### 2. `src/components/dashboard/ResolutionStatsCard.tsx`
- Card com 3 KPIs no topo: total de conversas, resolvidas autônomas (verde), escaladas (âmbar)
- Badge com a taxa de resolução percentual (ex: 87%)
- Gráfico de barras empilhadas (Recharts `BarChart`) com os últimos 7 dias: barras verdes (autônomas) vs âmbar (escaladas)
- Estados de loading (Skeleton) e vazio tratados

---

## Arquivo a modificar

### 3. `src/pages/AmeliaPage.tsx`
- Importar `ResolutionStatsCard`
- Adicionar dentro do grid de 2 colunas existente, como um novo card ao lado de um dos gráficos atuais

---

## Detalhes técnicos

- A view retorna dados por dia/empresa; o componente agrega as empresas ativas para o gráfico
- Usa `parseISO` + `format` do date-fns para labels do eixo X
- Nenhuma alteração de banco necessária — a view já existe e tem dados

