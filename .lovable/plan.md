

## Gamificacao + Analytics Avancado

Duas frentes independentes para fechar as lacunas apontadas: um sistema de gamificacao que engaja vendedores com pontos, badges e streaks, e um modulo de analytics enriquecido com funil visual, evolucao temporal com graficos e metricas de LTV.

---

### FRENTE 1: Gamificacao

#### 1.1 Tabelas no banco de dados

**`seller_badges`** — Definicoes de badges disponíveis:
- `id` (uuid PK), `key` (text unique, ex: `first_deal`, `streak_5`, `top_month`), `nome` (text), `descricao` (text), `icone` (text — nome do icone Lucide), `categoria` (text — FECHAMENTO, ATIVIDADE, STREAK, RANKING), `criterio_valor` (int — threshold numerico), `created_at`

**`seller_badge_awards`** — Badges conquistados por vendedores:
- `id` (uuid PK), `user_id` (uuid FK profiles), `badge_key` (text FK seller_badges.key), `empresa` (text), `awarded_at` (timestamptz default now()), `referencia` (text — ex: "2026-01", deal_id)
- Unique constraint: `(user_id, badge_key, referencia)`

**`seller_points_log`** — Registro de pontos:
- `id` (uuid PK), `user_id` (uuid), `empresa` (text), `pontos` (int), `tipo` (text — DEAL_GANHO, ATIVIDADE, FOLLOW_UP, BADGE_BONUS), `referencia_id` (text nullable), `created_at`

**`seller_leaderboard`** — View materializada (ou view simples):
- Agrega pontos do mes corrente, conta badges, calcula streak de dias consecutivos com atividades
- Campos: `user_id`, `vendedor_nome`, `vendedor_avatar`, `empresa`, `pontos_mes`, `total_badges`, `streak_dias`, `ranking_posicao`

**Seed de badges iniciais** (inseridos na migration):
| Key | Nome | Categoria | Criterio |
|-----|------|-----------|----------|
| `first_deal` | Primeiro Fechamento | FECHAMENTO | 1 deal ganho |
| `deal_10` | Decacampeao | FECHAMENTO | 10 deals ganhos |
| `deal_50` | Maquina de Vendas | FECHAMENTO | 50 deals ganhos |
| `streak_3` | Fogo Aceso | STREAK | 3 dias consecutivos |
| `streak_7` | Semana Perfeita | STREAK | 7 dias consecutivos |
| `streak_30` | Incansavel | STREAK | 30 dias consecutivos |
| `top_month` | Top do Mes | RANKING | #1 no ranking mensal |
| `meta_100` | Meta Batida | FECHAMENTO | 100% da meta |
| `meta_150` | Super Meta | FECHAMENTO | 150% da meta |
| `activity_50` | Produtivo | ATIVIDADE | 50 atividades na semana |

**RLS**: Filtrar por empresa via `get_user_empresa()`. Leitura para authenticated, escrita apenas service_role.

#### 1.2 Trigger de pontuacao automatica

Criar trigger `trg_gamify_deal_ganho` na tabela `deals` que, ao status mudar para 'GANHO':
- Insere registro em `seller_points_log` (ex: valor/1000 pontos, minimo 10)
- Verifica e concede badges de FECHAMENTO (contando deals ganhos do user)

Criar function `check_streak_badges(user_id, empresa)` chamada periodicamente ou via trigger de `deal_activities`.

#### 1.3 Componentes Frontend

**`src/hooks/useGamification.ts`**:
- `useLeaderboard(ano, mes)` — busca `seller_leaderboard`
- `useMyBadges()` — badges do usuario logado
- `useMyPoints(ano, mes)` — pontos do mes
- `useRecentAwards()` — ultimas conquistas da equipe (feed)

**`src/components/gamification/LeaderboardCard.tsx`**:
- Card com ranking top 5, mostrando avatar, nome, pontos, streak (icone fogo), badges count
- Medalhas dourada/prata/bronze nos 3 primeiros
- Barra de progresso relativa ao #1

**`src/components/gamification/BadgeShowcase.tsx`**:
- Grid de badges do usuario, conquistados com cor e brilho, nao conquistados em cinza com tooltip do criterio
- Animacao de "unlock" quando badge e novo (awarded_at < 24h)

**`src/components/gamification/PointsFeedCard.tsx`**:
- Lista das ultimas 10 movimentacoes de pontos da equipe ("Joao fechou deal +45pts", "Maria conquistou Semana Perfeita")

#### 1.4 Integracao nas paginas existentes

**MetasPage** — Adicionar aba "Gamificacao" no TabsList com:
- LeaderboardCard (ranking com pontos)
- BadgeShowcase (do usuario logado)

**WorkbenchPage** — Adicionar mini-card abaixo dos KPIs:
- Streak atual (icone fogo + numero), posicao no ranking, proximo badge a conquistar
- So exibe se ha dados

---

### FRENTE 2: Analytics Avancado

#### 2.1 Views SQL adicionais

**`analytics_funil_visual`** — View que calcula a conversao entre etapas adjacentes:
- `pipeline_id`, `pipeline_nome`, `empresa`, `from_stage`, `to_stage`, `deals_entrada`, `deals_saida`, `taxa_conversao`, `valor_entrada`, `valor_saida`
- Usa `deal_stage_history` para calcular movimentacoes reais entre stages

**`analytics_evolucao_mensal`** — View que consolida metricas mensais (ultimos 12 meses):
- `mes`, `empresa`, `pipeline_id`, `deals_criados`, `deals_ganhos`, `deals_perdidos`, `valor_ganho`, `valor_perdido`, `win_rate`, `ticket_medio`, `ciclo_medio_dias`
- Base para grafico de linha temporal

**`analytics_ltv_cohort`** — View de LTV por cohort de mes de criacao:
- `cohort_mes` (mes de criacao do deal), `empresa`, `total_deals`, `deals_ganhos`, `valor_total`, `ltv_medio` (valor_total / total_deals), `win_rate`
- Permite ver como cada "safra" de leads performa

#### 2.2 Hooks

**`src/hooks/useAnalytics.ts`** — Adicionar:
- `useAnalyticsFunilVisual(pipelineId)` — funil com taxas entre etapas
- `useAnalyticsEvolucao(pipelineId)` — serie temporal 12 meses
- `useAnalyticsLTV()` — cohort LTV

#### 2.3 Componentes de visualizacao

**`src/components/analytics/FunnelChart.tsx`**:
- Funil visual usando barras horizontais decrescentes (estilo trapezio) com Recharts BarChart customizado
- Cada barra mostra: nome do stage, quantidade de deals, valor, taxa de conversao para o proximo stage
- Cores gradientes do verde ao vermelho conforme a taxa

**`src/components/analytics/EvolutionChart.tsx`**:
- Grafico de area/linha (Recharts ComposedChart) com:
  - Linha de deals ganhos (verde) e perdidos (vermelho)
  - Area de valor ganho
  - Linha tracejada de win rate (eixo Y secundario)
- Seletor de periodo (6m / 12m)

**`src/components/analytics/LTVCohortTable.tsx`**:
- Tabela com heatmap de cores por cohort
- Colunas: Mes de entrada, Total deals, Ganhos, Win Rate, LTV Medio
- Celulas com fundo colorido proporcional ao valor (verde = alto LTV, vermelho = baixo)

#### 2.4 Integracao na AnalyticsPage

Adicionar 3 novas tabs ao TabsList existente:
- **"Funil Visual"** — FunnelChart
- **"Evolucao"** — EvolutionChart
- **"LTV & Cohort"** — LTVCohortTable

---

### Secao Tecnica — Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| **Migration SQL** | Criar tabelas `seller_badges`, `seller_badge_awards`, `seller_points_log`; view `seller_leaderboard`; views `analytics_funil_visual`, `analytics_evolucao_mensal`, `analytics_ltv_cohort`; trigger `trg_gamify_deal_ganho`; seed de badges; RLS policies |
| `src/hooks/useGamification.ts` | Criar — hooks de leaderboard, badges, pontos |
| `src/hooks/useAnalytics.ts` | Editar — adicionar 3 hooks (funil visual, evolucao, LTV) |
| `src/types/gamification.ts` | Criar — tipos Badge, BadgeAward, PointsLog, LeaderboardEntry |
| `src/types/analytics.ts` | Editar — adicionar tipos FunilVisual, EvolucaoMensal, LTVCohort |
| `src/components/gamification/LeaderboardCard.tsx` | Criar |
| `src/components/gamification/BadgeShowcase.tsx` | Criar |
| `src/components/gamification/PointsFeedCard.tsx` | Criar |
| `src/components/gamification/WorkbenchGamificationCard.tsx` | Criar — mini card para o Meu Dia |
| `src/components/analytics/FunnelChart.tsx` | Criar |
| `src/components/analytics/EvolutionChart.tsx` | Criar |
| `src/components/analytics/LTVCohortTable.tsx` | Criar |
| `src/pages/MetasPage.tsx` | Editar — adicionar aba Gamificacao |
| `src/pages/WorkbenchPage.tsx` | Editar — adicionar mini card gamificacao |
| `src/pages/AnalyticsPage.tsx` | Editar — adicionar 3 tabs |

