

# Fase 3: Inteligencia Avancada CS

Fase 3 transforma o modulo CS de operacional para estrategico, com predicao de churn, projecao de receita, analise de tendencias por IA, gamificacao CS e CSAT automatico.

---

## Bloco 1: Churn Prediction Model

### O que faz
Calcula `risco_churn_pct` para cada cliente CS com base em padroes historicos: tendencia do health score, NPS, tempo sem contato e padroes de clientes que ja churnou.

### Implementacao
1. **Edge function `cs-churn-predictor`**: Roda via cron diario.
   - Para cada cliente ativo, analisa:
     - Health score trend (ultimos 3 registros em `cs_health_log`) — se caindo = risco sobe
     - NPS trend — se ultimo NPS < anterior = risco sobe
     - Dias sem contato (`ultimo_contato_em`) — mais de 30 dias = risco sobe
     - Incidencias abertas nao resolvidas — mais incidencias = risco sobe
     - Padrao historico: clientes inativos (`is_active=false`) servem como referencia
   - Calcula score 0-100 de risco
   - Atualiza `cs_customers.risco_churn_pct`
   - Se risco > 70%, cria notificacao para CSM

2. **Card no Dashboard**: Novo card "Churn Risk" no CSDashboardPage com mini lista dos top 5 clientes com maior risco.

3. **Coluna na lista de clientes**: Adicionar coluna "Risco Churn" na CSClientesPage.

### Arquivos
- `supabase/functions/cs-churn-predictor/index.ts` (Criar)
- `supabase/config.toml` (Adicionar function)
- `src/pages/cs/CSDashboardPage.tsx` (Editar — novo card)
- `src/pages/cs/CSClientesPage.tsx` (Editar — coluna risco)

---

## Bloco 2: Revenue Forecasting

### O que faz
Projeta MRR futuro com base nos health scores e risco de churn. Clientes saudaveis = receita provavel. Clientes em risco = receita em perigo.

### Implementacao
1. **Hook `useCSRevenueForecast`**: Calcula no frontend com dados ja disponiveis:
   - MRR seguro: soma MRR dos clientes SAUDAVEL
   - MRR em atencao: soma MRR dos ATENCAO * 0.8
   - MRR em risco: soma MRR dos EM_RISCO * 0.5
   - MRR critico: soma MRR dos CRITICO * 0.2
   - MRR projetado = soma ponderada
   - Renovacoes projetadas: filtra por proxima_renovacao nos proximos 90 dias

2. **Componente `CSRevenueCard`**: Card no dashboard com:
   - MRR atual total
   - MRR projetado (com ponderacao por health)
   - Receita em risco (diferenca)
   - Mini bar chart por segmento de health

### Arquivos
- `src/hooks/useCSRevenueForecast.ts` (Criar)
- `src/components/cs/CSRevenueCard.tsx` (Criar)
- `src/pages/cs/CSDashboardPage.tsx` (Editar — incluir card)

---

## Bloco 3: Trending Topics + Word Cloud NPS

### O que faz
Usa IA para analisar respostas de pesquisas (texto livre) e agrupar em temas recorrentes. Exibe word cloud com palavras-chave mais frequentes.

### Implementacao
1. **Edge function `cs-trending-topics`**: Chamada manual ou via cron semanal.
   - Busca `cs_surveys` com `texto_resposta` nao nulo dos ultimos 90 dias
   - Envia para Lovable AI (gemini-3-flash-preview) com prompt:
     "Analise estas respostas de clientes e extraia: 1) Top 5 temas recorrentes com frequencia, 2) Sentimento geral por tema, 3) Palavras-chave mais citadas com contagem"
   - Salva resultado em `system_settings` com key `cs.trending_topics`
   - Retorna JSON estruturado

2. **Componente `CSTrendingTopicsCard`**: Card no dashboard com:
   - Lista de temas com badge de sentimento
   - Word cloud simples (tags com tamanho proporcional a frequencia — implementado com CSS/flex, sem lib externa)

3. **Tab "Analise" na CSPesquisasPage**: Nova tab com trending topics e word cloud.

### Arquivos
- `supabase/functions/cs-trending-topics/index.ts` (Criar)
- `supabase/config.toml` (Adicionar function)
- `src/components/cs/CSTrendingTopicsCard.tsx` (Criar)
- `src/pages/cs/CSPesquisasPage.tsx` (Editar — nova tab)
- `src/pages/cs/CSDashboardPage.tsx` (Editar — incluir card)

---

## Bloco 4: CSAT Automatico pos-interacao

### O que faz
Apos cada interacao relevante (reuniao, call, resolucao de incidencia), envia CSAT automaticamente pedindo nota 1-5.

### Implementacao
1. **Trigger SQL**: Apos UPDATE em `cs_incidents` com status mudando para RESOLVIDA:
   - Chama edge function `cs-nps-auto` com parametro `tipo=CSAT` e `customer_id`
   - O `cs-nps-auto` ja existe — adicionar suporte a `tipo=CSAT` na logica existente

2. **Atualizar `cs-nps-auto`**: Aceitar parametro `tipo` (NPS ou CSAT) e ajustar pergunta e template.

### Arquivos
- `supabase/functions/cs-nps-auto/index.ts` (Editar)
- Migration SQL para trigger de CSAT automatico

---

## Bloco 5: Gamificacao CS (Badges para CSMs)

### O que faz
Badges e pontos para CSMs baseados em acoes de retencao: resolver incidencias, resgatar clientes em risco, manter NPS alto.

### Implementacao
1. **Inserir badges CS** na tabela `seller_badges` (ja existente):
   - `cs_rescue_1`: "Resgatou 1 cliente em risco" (cliente saiu de EM_RISCO/CRITICO para ATENCAO/SAUDAVEL)
   - `cs_rescue_5`: "Resgatou 5 clientes em risco"
   - `cs_incident_resolver`: "Resolveu 10 incidencias"
   - `cs_nps_champion`: "Manteve NPS medio >= 8 por 3 meses"
   - `cs_retention_master`: "100% de renovacoes no trimestre"

2. **Trigger SQL em cs_health_log**: Quando status melhora (EM_RISCO/CRITICO -> ATENCAO/SAUDAVEL):
   - Atribuir pontos ao CSM (via `seller_points_log`)
   - Verificar criterio de badges e atribuir se atingido

3. **Trigger SQL em cs_incidents**: Quando status muda para RESOLVIDA:
   - Atribuir 10 pontos ao responsavel
   - Verificar badge `cs_incident_resolver`

### Arquivos
- Migration SQL (inserir badges + triggers)
- Nenhum arquivo frontend novo (usa gamificacao existente)

---

## Bloco 6: Benchmarks Internos

### O que faz
Compara health scores entre segmentos: por empresa (BLUE vs TOKENIZA), por CSM, por faixa de MRR.

### Implementacao
1. **Componente `CSBenchmarkCard`**: Card no dashboard com:
   - Health medio por empresa
   - Health medio por CSM (bar chart horizontal)
   - Distribuicao por faixa de MRR

2. **Hook `useCSBenchmarks`**: Agrupa dados de `cs_customers` por empresa, csm_id e faixa de MRR.

### Arquivos
- `src/hooks/useCSBenchmarks.ts` (Criar)
- `src/components/cs/CSBenchmarkCard.tsx` (Criar)
- `src/pages/cs/CSDashboardPage.tsx` (Editar — incluir card)

---

## Ordem de Execucao

1. **Bloco 1**: Churn Prediction (valor imediato, usa dados existentes)
2. **Bloco 2**: Revenue Forecasting (frontend only, rapido)
3. **Bloco 4**: CSAT automatico (extensao do cs-nps-auto existente)
4. **Bloco 5**: Gamificacao CS (badges + triggers SQL)
5. **Bloco 3**: Trending Topics (requer IA, mais complexo)
6. **Bloco 6**: Benchmarks (complementar, frontend only)

---

## Resumo de Entregas

| Item | Tipo | Arquivo |
|------|------|---------|
| cs-churn-predictor | Edge Function | supabase/functions/cs-churn-predictor/index.ts |
| cs-trending-topics | Edge Function | supabase/functions/cs-trending-topics/index.ts |
| useCSRevenueForecast | Hook | src/hooks/useCSRevenueForecast.ts |
| useCSBenchmarks | Hook | src/hooks/useCSBenchmarks.ts |
| CSRevenueCard | Componente | src/components/cs/CSRevenueCard.tsx |
| CSTrendingTopicsCard | Componente | src/components/cs/CSTrendingTopicsCard.tsx |
| CSBenchmarkCard | Componente | src/components/cs/CSBenchmarkCard.tsx |
| CSDashboardPage | Editar | 3 novos cards (churn, revenue, benchmark) |
| CSClientesPage | Editar | coluna risco churn |
| CSPesquisasPage | Editar | tab analise com trending |
| cs-nps-auto | Editar | suporte CSAT |
| Badges CS | INSERT SQL | 5 badges na seller_badges |
| Triggers gamificacao | Migration SQL | pontos e badges para CSMs |
| config.toml | Editar | 2 novas functions |
| Cron jobs | INSERT SQL | 2 novos schedules |

