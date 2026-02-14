
# Plano Unificado — Patches 4 a 9: Auditoria Linha a Linha + Execucao

---

## PATCH 4 — Estabilizacao + Migracao IA

| # | Tarefa PO | Status | Acao |
|---|-----------|--------|------|
| T1 | Migrar edge functions Lovable/Gemini para Anthropic | 100% FEITO | 8 functions migradas. Zero refs a ai.gateway.lovable.dev |
| T2 | Configurar pg_cron para 7 functions CS | 100% FEITO | 7 cron jobs ativos |
| T3a | PipelinePage ler ?deal= param | FEITO | L44 useSearchParams |
| T3b | OrganizationsPage ler ?open= param | FEITO | Confirmado |
| T4 | ErrorBoundary granular | FEITO | App.tsx wrapping por grupo |
| T5 | Fix cs-nps-auto janela 90 dias | FEITO | Logica corrigida |
| T6 | classification.ts import de enums | FEITO | L6: `export type { EmpresaTipo } from './enums'` |

**RESULTADO: 100% implementado. Nenhuma acao necessaria.**

---

## PATCH 5 — Pipeline Inteligente

| # | Tarefa PO | Status | Pendencia |
|---|-----------|--------|-----------|
| T1a | Colunas deals: probabilidade_fechamento, scoring_dimensoes, proxima_acao_sugerida, scoring_updated_at | PARCIAL | `score_probabilidade` (INT) existe. FALTAM: `scoring_dimensoes jsonb`, `proxima_acao_sugerida text`, `scoring_updated_at timestamptz`. PO pede `probabilidade_fechamento` mas DB tem `score_probabilidade` — manter nome existente. |
| T1b | Edge function deal-scoring (6 dimensoes + IA) | NAO EXISTE | `fn_calc_deal_score` existe como funcao SQL com 4 dimensoes (stage rate, time, temperature, engagement). PO pede 6 dimensoes + Claude para proxima_acao. Criar edge function completa. |
| T1c | CRON deal-scoring-daily + trigger em deal_activities | NAO EXISTE | Zero cron, zero trigger de scoring on activity |
| T2 | Kanban Card enriquecido (proxima acao footer, SLA borda, dias vs media warning) | PARCIAL | DealCard.tsx ja tem: badge probabilidade (score_probabilidade), temperatura badge, dias na stage, valor. FALTAM: proxima_acao_sugerida no footer, borda SLA colorida, warning quando dias > media |
| T3 | Ordenacao inteligente no Kanban (urgency score + toggle IA/Manual) | NAO EXISTE | Zero urgency score, zero toggle. KanbanColumn renderiza na ordem que vem |
| T4 | NBA V2 enriquecido (deal_scores, cs_alerts, cadences, sentiment + narrativa_dia) | PARCIAL | NBA funciona com Anthropic. Contexto: tarefas, SLA, deals parados, leads quentes. FALTAM: deal_scores top 10, cs_alerts, cadence_active, sentiment_recent, campo narrativa_dia no UI |
| T5a | Tabela pipeline_auto_rules | NAO EXISTE | Tabela nao existe |
| T5b | Trigger fn_deal_auto_advance em deal_activities | NAO EXISTE | Zero trigger auto-advance |
| T5c | UI de configuracao de regras automaticas | NAO EXISTE | Nenhuma UI |
| T6 | Deal Detail Sidebar IA (gauge probabilidade, breakdown dimensoes, proxima acao, botao refresh) | NAO EXISTE | DealDetailSheet tem tab "Scores" com 4 barras basicas (engajamento, intencao, valor, urgencia). FALTAM: gauge grande, breakdown 6 dimensoes, proxima_acao_sugerida em destaque, botao refresh |

**RESULTADO: ~15% implementado.**

---

## PATCH 6 — CS Fase 2: Automacao

| # | Tarefa PO | Status | Pendencia |
|---|-----------|--------|-----------|
| T1a | Tabela cs_playbook_runs (tracking multi-step com delays) | NAO EXISTE | Tabela nao existe |
| T1b | cs-playbook-runner com deteccao automatica de triggers + multi-step com delays | PARCIAL | Versao atual e simples: recebe trigger_type+customer_id, executa steps inline sem tracking. NAO tem: deteccao automatica, cs_playbook_runs, delays entre steps, fases separadas |
| T1c | Playbooks pre-configurados (seed 5 playbooks) | VERIFICAR | Precisa confirmar se ha INSERTs nas migrations |
| T2 | Dashboard CS com Briefing IA | FEITO | CSDailyBriefingCard implementado |
| T3 | CSClienteDetail 7 tabs completas | PARCIAL | Tem 5 tabs: Pesquisas, Deals (lazy), Renovacao, Incidencias, Health Log. FALTAM: Visao Geral (timeline unificada), Atividades/Notas (campo texto livre + historico) |
| T4 | Botao NPS via WhatsApp | FEITO | handleSendNpsWhatsApp existe L51-63 |
| T5 | CSAT automatico pos-resolucao de incidencia | FEITO | fn_cs_auto_csat_on_resolve existe |

**RESULTADO: ~55% implementado.**

---

## PATCH 7 — Automacao Ponta a Ponta

| # | Tarefa PO | Status | Pendencia |
|---|-----------|--------|-----------|
| T1a | Deal auto-creation de lead qualificado (sdr-ia-interpret) | FEITO | sdr-ia-interpret cria deal quando CRIAR_TAREFA_CLOSER ou INTERESSE_COMPRA |
| T1b | Coluna deals.origem (MANUAL, AUTO_SDR, AUTO_RENOVACAO, IMPORTACAO) | NAO EXISTE | Coluna nao existe. Deal auto-criado nao tem campo origem |
| T2 | Auto-fill de campos via IA (CreateDealDialog) | FEITO | useDealAutoFill.ts funciona no CreateDealDialog. Pre-preenche titulo/valor/temperatura. PO pede edge function mais robusta com Claude + knowledge_products — aceitar como melhoria futura |
| T3a | Edge function deal-context-summary (handoff SDR-Closer) | NAO EXISTE | Nenhuma function |
| T3b | Card "Contexto SDR" no DealDetailSheet | NAO EXISTE | Zero accordion com resumo/DISC/objecoes/frameworks |
| T4 | Ponte CS - Pipeline Renovacao (playbook cria deal) | NAO EXISTE | cs-playbook-runner nao cria deals |

**RESULTADO: ~30% implementado.**

---

## PATCH 8 — Telefonia Completa

### Fase A — WebRTC Softphone

| # | Item PO | Status | Pendencia |
|---|---------|--------|-----------|
| A1 | Widget flutuante FAB | FEITO | ZadarmaPhoneWidget.tsx — fixed bottom-6 right-6 |
| A2 | Estados IDLE/DIALING/RINGING/IN_CALL/ON_HOLD | PARCIAL | Tem: idle/dialing/active/ended. FALTAM: ringing (inbound), on_hold |
| A3 | Timer, mute, hangup, nome contato | FEITO | Timer OK, mute OK, hangup OK, contactName OK |
| A4 | Botao hold | NAO EXISTE | Nenhum botao/estado hold |
| A5 | Deal associado exibido | NAO EXISTE | dealId armazenado mas nao exibido na UI |
| A6 | Maximizavel com coaching sidebar | NAO EXISTE | Maximize2 importado mas nao usado |
| A7 | WebRTC SDK real | NAO EXISTE | Usa callback API (click_to_call). Recomendacao: manter callback como MVP |
| A8 | Click-to-Call em ContactDetail, DealDetail, CSCliente, LeadDetail | NAO EXISTE | Zero componente ClickToCallButton. Zero dispatchEvent bluecrm:dial |

### Fase B — Call Logging

| # | Item PO | Status | Pendencia |
|---|---------|--------|-----------|
| B1 | Tabela call_logs | JA EXISTE como `calls` | Colunas existentes: id, empresa, deal_id, contact_id, user_id, direcao, status, pbx_call_id, caller_number, destination_number, duracao_segundos, recording_url, started_at, answered_at, ended_at. FALTAM: transcription, summary_ia, sentiment, action_items, cs_customer_id |
| B2 | zadarma-webhook salva CDR | FEITO | Processa NOTIFY_START/ANSWER/END/RECORD |
| B3 | Auto-create deal_activity tipo CALL | NAO EXISTE | Webhook salva em `calls` mas NAO cria deal_activities |
| B4 | Resolver contact_id por numero | FEITO | Webhook L91-97 |
| B5 | Associar ao deal mais recente | FEITO | Webhook L100-108 |

### Fase C — Transcricao + Sumarizacao

| # | Item PO | Status | Pendencia |
|---|---------|--------|-----------|
| C1 | Edge function call-transcribe | NAO EXISTE | Zero function |
| C2 | Download recording + STT (Whisper/Deepgram) | NAO EXISTE | Requer API key externa |
| C3 | Claude gera summary_ia, sentiment, action_items | NAO EXISTE | Zero processamento IA |
| C4 | Criar deal_activity com summary | NAO EXISTE | Zero integracao |
| C5 | Sentimento NEGATIVO cria cs_incident | NAO EXISTE | Zero integracao chamada-CS |
| C6 | Player audio inline no DealDetail | FEITO | DealCallsPanel.tsx L57 audio controls |
| C7 | Expand com resumo IA, sentiment badge, action items | NAO EXISTE | Expand so mostra player |
| C8 | Modal transcricao completa | NAO EXISTE | Zero modal |

### Fase D — Coaching IA em Tempo Real

| # | Item PO | Status | Pendencia |
|---|---------|--------|-----------|
| D1 | CoachingSidebar | NAO EXISTE | Zero componente |
| D2 | WebSocket/polling para chunks | NAO EXISTE | Zero streaming |
| D3-D7 | Deal context, frameworks, sugestoes, objecoes, battlecard, talk ratio, sentimento | NAO EXISTE | Totalmente inexistente |

**RESULTADO: ~20% implementado.**

---

## PATCH 9 — Analytics Avancado

### T1 — Revenue Forecast

| # | Item PO | Status | Pendencia |
|---|---------|--------|-----------|
| 1a | Edge function revenue-forecast | NAO EXISTE | Nenhuma edge function |
| 1b | MRR projetado basico (client-side) | PARCIAL | useCSRevenueForecast.ts calcula mrrTotal, mrrProjetado. Porem: nao usa deal scoring, nao calcula Pipeline Velocity, nao tem P25/P50/P75 |
| 1c | Tabela revenue_forecast_log | NAO EXISTE | Tabela nao existe |
| 1d | Card no Dashboard + grafico projecao | PARCIAL | CSRevenueCard existe no dashboard CS. Falta no dashboard principal + grafico de linha |

### T2 — Pipeline Velocity

| # | Item PO | Status | Pendencia |
|---|---------|--------|-----------|
| 2a | Tempo medio em cada stage | PARCIAL | deal_stage_history existe com tempo_no_stage_anterior_ms. Funil mostra tempo_medio_min por stage. Porem nao ha grafico de barras dedicado |
| 2b | Grafico barras horizontais por stage | NAO EXISTE | Funil usa barras de deals_count, nao tempo |
| 2c | Highlight stages com aumento >20% | NAO EXISTE | Zero comparacao temporal |
| 2d | Drill-down por stage | NAO EXISTE | Clicar no funil nao abre deals |
| 2e | deal_stage_history colunas extras (changed_by, auto_advanced) | NAO EXISTE | Colunas nao existem |

### T3 — Win/Loss Analysis IA

| # | Item PO | Status | Pendencia |
|---|---------|--------|-----------|
| 3a | Edge function win-loss-analysis (portfolio) | PARCIAL | deal-loss-analysis existe mas: (1) so analisa perdas, (2) deal individual, nao portfolio |
| 3b | Funil conversao com % | FEITO | FunnelChart + useAnalyticsFunilVisual |
| 3c | Vendedores por stage | PARCIAL | Ranking com ganhos/perdidos/win rate mas nao POR stage |
| 3d | Motivos agrupados por IA | PARCIAL | Badge categoria manual, nao agrupamento IA |
| 3e | Padroes deals ganhos + recomendacoes | NAO EXISTE | Zero analise de padroes de sucesso |
| 3f | Card narrativo de insights | NAO EXISTE | Zero output narrativo |

### T4 — Comparacao de Periodo

| # | Item PO | Status | Pendencia |
|---|---------|--------|-----------|
| 4a | Date range picker com presets | NAO EXISTE | Filtro apenas por pipeline |
| 4b | Delta % com seta verde/vermelha | NAO EXISTE | KPIs absolutos sem comparacao |

### T5 — Dashboard Executivo

| # | Item PO | Status | Pendencia |
|---|---------|--------|-----------|
| 5a | Pagina /relatorios/executivo | NAO EXISTE | Nenhuma rota |
| 5b | 8 KPIs (ARR, MRR, NRR, Pipeline Value, Win Rate, Avg Deal, Sales Cycle, Churn, NPS) | PARCIAL | 6 KPIs basicos no AnalyticsPage. Faltam: ARR, NRR, Churn Rate, NPS Score |
| 5c | Sparklines 6 meses | NAO EXISTE | Zero sparklines |
| 5d | Delta vs mes anterior | NAO EXISTE | Igual T4 |

### T6 — Relatorio IA Semanal

| # | Item PO | Status | Pendencia |
|---|---------|--------|-----------|
| 6a | Edge function weekly-report | NAO EXISTE | Nenhuma function |
| 6b | CRON domingo 20h | NAO EXISTE | Zero cron |
| 6c | Claude gera relatorio narrativo | NAO EXISTE | Zero processamento |
| 6d | Notifica ADMINs | NAO EXISTE | Nenhuma notificacao |

**RESULTADO: ~10% implementado.**

---

## Secao 5 da Auditoria V2 — Gaps IA-First (ja resolvidos nesta sessao)

| # | Gap | Status |
|---|-----|--------|
| 1 | Meu Dia sem NBA | FEITO |
| 2 | Pipeline sem scoring | FEITO (basico, upgrade no Patch 5) |
| 3 | Notificacoes proativas | FEITO |
| 4 | Deal creation nao automatica | FEITO |
| 5 | Auto-fill campos via IA | FEITO (useDealAutoFill + CreateDealDialog) |
| 6 | Sumarizacao chamadas | Fora de escopo (requer STT API) |
| 7 | Email compose na conversa | FEITO (ConversationPanel com botao Mail) |
| 8 | Sentimento em tempo real | FEITO (SentimentBadge no ConversationView) |

---

## PLANO DE EXECUCAO CONSOLIDADO

Organizando em 12 blocos sequenciais por dependencia:

### Bloco 1 — Schema SQL (Migration Unica)

Alteracoes na tabela `deals`:
- ADD COLUMN `scoring_dimensoes jsonb DEFAULT NULL`
- ADD COLUMN `proxima_acao_sugerida text DEFAULT NULL`
- ADD COLUMN `scoring_updated_at timestamptz DEFAULT NULL`
- ADD COLUMN `origem text DEFAULT 'MANUAL'`

Alteracoes na tabela `calls`:
- ADD COLUMN `transcription text`
- ADD COLUMN `summary_ia text`
- ADD COLUMN `sentiment text`
- ADD COLUMN `action_items jsonb`
- ADD COLUMN `cs_customer_id uuid REFERENCES cs_customers(id)`

Alteracoes na tabela `deal_stage_history`:
- ADD COLUMN `changed_by uuid`
- ADD COLUMN `auto_advanced boolean DEFAULT false`

Nova tabela `pipeline_auto_rules`:
- id uuid PK, pipeline_id, empresa, from_stage_id, to_stage_id, trigger_type, trigger_config jsonb, is_active, created_at, updated_at
- RLS habilitado + policies

Nova tabela `cs_playbook_runs`:
- id uuid PK, playbook_id, customer_id, empresa, status (ATIVA/PAUSADA/CONCLUIDA/CANCELADA), current_step, step_results jsonb, started_at, next_step_at, completed_at
- Index em next_step_at WHERE status=ATIVA
- RLS habilitado + policies

Nova tabela `revenue_forecast_log`:
- id uuid PK, empresa, forecast_date, horizonte_dias, pessimista, realista, otimista, detalhes jsonb, created_at
- RLS habilitado

Trigger `fn_deal_auto_advance` em deal_activities:
- Quando atividade criada, verifica pipeline_auto_rules para o stage atual
- Se match: move deal para to_stage_id, marca auto_advanced=true no deal_stage_history

Trigger auto-create deal_activity tipo CALL quando `calls` inserida com deal_id nao null.

### Bloco 2 — Edge Function: deal-scoring (Patch 5 T1b)

Novo arquivo: `supabase/functions/deal-scoring/index.ts`

- Recebe opcionalmente `{ deal_id }`. Se nao, processa TODOS deals ABERTO
- 6 dimensoes calculadas em paralelo (Promise.all):
  1. Stage Progress (25%): posicao stage / total stages
  2. Tempo na Stage (20%): dias atuais vs media historica (deal_stage_history)
  3. Engajamento (20%): deal_activities ultimos 14d — REUNIAO=3, CALL=2, EMAIL=1, NOTA=1
  4. Temperatura Lead (15%): lead_classifications via contacts.legacy_lead_id
  5. Valor vs Ticket (10%): valor deal vs ticket medio deals GANHO no mesmo pipeline
  6. Sentimento (10%): ultimo lead_message_intents
- Score ponderado 0-100 salvo em deals.score_probabilidade + scoring_dimensoes + scoring_updated_at
- Claude gera proxima_acao_sugerida (1 frase acionavel)
- Se probabilidade caiu >20 pontos: cria notification para owner
- Usa Anthropic API direto (ANTHROPIC_API_KEY)

### Bloco 3 — Edge Function: deal-context-summary (Patch 7 T3a)

Novo arquivo: `supabase/functions/deal-context-summary/index.ts`

- Recebe `{ deal_id }`
- Busca: lead_messages (via contact bridge), lead_conversation_state (frameworks), lead_classifications (ICP/DISC)
- Claude gera: resumo conversa, perfil DISC + approach, objecoes identificadas, framework progress, sugestao para closer
- Salva em deals como campo jsonb `contexto_sdr` (ou nova coluna na migration)
- Usa Anthropic API

### Bloco 4 — Upgrade cs-playbook-runner (Patch 6 T1b)

Reescrever `supabase/functions/cs-playbook-runner/index.ts`:

- FASE 1 — Deteccao automatica de triggers:
  - DEAL_GANHO: cs_customers recentes sem playbook_run de Onboarding
  - NPS_DETRATOR: cs_surveys com nota <= 6 sem playbook Detrator
  - HEALTH_CAIU: cs_health_log com status mudou para EM_RISCO/CRITICO
  - RENOVACAO_PROXIMA: cs_customers com proxima_renovacao <= 60 dias
  - Para cada match: criar cs_playbook_runs com next_step_at = now()
- FASE 2 — Executar steps pendentes:
  - Buscar cs_playbook_runs com status=ATIVA e next_step_at <= now()
  - Executar step atual (WHATSAPP, CSAT, REUNIAO, ALERTA, ESCALAR)
  - Avancar current_step, calcular next_step_at com delay_days
  - Se ultimo step: status=CONCLUIDA
- PONTE CS-RENOVACAO (Patch 7 T4): quando step = 'CRIAR_DEAL_RENOVACAO':
  - Buscar pipeline tipo=RENOVACAO da empresa
  - Criar deal: titulo 'Renovacao: {nome}', valor MRR*12, contact_id
  - Se health < 50: flag RISCO + notificar gestor

### Bloco 5 — Edge Function: revenue-forecast (Patch 9 T1)

Novo arquivo: `supabase/functions/revenue-forecast/index.ts`

- CRON diario 6h
- Para cada deal ABERTO: valor * score_probabilidade/100 = contribuicao esperada
- Para cada cs_customer ativo: MRR * (1 - risco_churn_pct/100) = MRR projetado retido
- Pipeline Velocity: tempo medio fechamento por pipeline (deal_stage_history)
- P25/P50/P75 baseado em variancia historica
- Salva em system_settings key='revenue_forecast' + revenue_forecast_log

### Bloco 6 — Upgrade deal-loss-analysis para win-loss (Patch 9 T3)

Modificar `supabase/functions/deal-loss-analysis/index.ts`:

- Aceitar modo `{ mode: 'portfolio' }` (alem do individual existente)
- Portfolio: busca deals GANHO e PERDIDO ultimos 90 dias
- Claude analisa: drop-off por stage, vendedores que convertem, motivos recorrentes, padroes sucesso, 3-5 recomendacoes
- Salva em system_settings key='win_loss_analysis'

### Bloco 7 — Edge Function: weekly-report (Patch 9 T6)

Novo arquivo: `supabase/functions/weekly-report/index.ts`

- CRON domingo 20h
- Coleta: deals fechados na semana, clientes risco, NPS, pipeline, atividades
- Claude gera 2-3 paragrafos narrativos
- Salva em system_settings + cria notifications para usuarios ADMIN

### Bloco 8 — Telefonia: ClickToCallButton + PhoneWidget (Patch 8)

Novo componente: `src/components/zadarma/ClickToCallButton.tsx`
- Recebe phone, contactName, dealId, customerId
- Dispara `window.dispatchEvent(new CustomEvent('bluecrm:dial', { detail: {...} }))`
- Integrar em: ContactDetailSheet, DealDetailSheet, CSClienteDetailPage, LeadDetail

Atualizar `ZadarmaPhoneWidget.tsx`:
- Adicionar estado on_hold com botao Pause
- Exibir titulo do deal associado quando dealId preenchido
- Preparar slot para CoachingSidebar (Maximize2 abre painel lateral)
- NOTA: Manter callback API como MVP (WebRTC real e evolucao futura)

Atualizar `zadarma-webhook/index.ts`:
- Apos salvar chamada em `calls`, se deal_id nao null: INSERT deal_activities tipo=CALL com duracao + link recording

Atualizar `DealCallsPanel.tsx`:
- Quando expand: mostrar summary_ia, sentiment badge, action_items como lista
- Botao "Ver transcricao" abre Dialog com texto completo

### Bloco 9 — Pipeline UI (Patch 5 T2, T3, T6)

**DealCard.tsx** enriquecido:
- Footer: proxima_acao_sugerida em texto italic 11px
- Borda esquerda colorida: verde normal, amarelo >75% SLA, vermelho SLA estourado
- Dias na stage: vermelho + warning se > media historica

**KanbanColumn.tsx / KanbanBoard.tsx** ordenacao inteligente:
- Toggle no topo: "Ordenacao IA" vs "Manual"
- Urgency Score = (100 - probabilidade) * 0.4 + dias_norm * 0.3 + sla_pct * 0.2 + valor_norm * 0.1
- IA ligada: sort por urgency DESC, drag-and-drop desabilitado
- Manual: comportamento atual
- Persistir preferencia no localStorage

**DealDetailSheet.tsx** — Card "Amelia Insights" (substituir/enriquecer tab Scores):
- Gauge ou barra grande de probabilidade com numero + cor
- Breakdown 6 dimensoes em mini barras horizontais (scoring_dimensoes)
- proxima_acao_sugerida em destaque
- Botao "Refresh" que chama deal-scoring com deal_id
- Card "Contexto SDR" (accordion): resumo, DISC, objecoes, frameworks, sugestao (Patch 7 T3b)

### Bloco 10 — NBA V2 + Narrativa do Dia (Patch 5 T4)

Atualizar `supabase/functions/next-best-action/index.ts`:
- Adicionar ao contexto: deal_scores (top 10 com dimensoes), cs_alerts (health < 60 ou renovacao 30d), cadence_active, sentiment_recent (ultimas 5 mensagens)
- Adicionar ao prompt: campo narrativa_dia (2-3 frases resumindo foco do dia)

Atualizar `NextBestActionCard.tsx`:
- Novo campo narrativa_dia exibido como paragrafo no topo, antes da lista de acoes
- Texto normal, cor muted, 13px

### Bloco 11 — Analytics UI Avancado (Patch 9 T2, T4, T5)

**AnalyticsPage.tsx**:
- Date range picker com presets (Este mes, Mes passado, Trimestre, Custom)
- Cada KPI com delta % vs periodo anterior (seta verde/vermelha)
- Nova tab "Velocity" com grafico barras horizontais (dias por stage)
- Nova tab "Insights IA" com botao "Analisar" que chama deal-loss-analysis em modo portfolio
- Card narrativo com resultado

**Nova pagina: AnalyticsExecutivoPage.tsx** (rota /relatorios/executivo):
- 8 KPIs grandes: ARR, MRR, NRR, Pipeline Value, Win Rate, Avg Deal Size, Sales Cycle, Churn Rate, NPS
- Cada com sparkline 6 meses (recharts Line micro)
- Delta vs mes anterior
- Adicionar rota em App.tsx

### Bloco 12 — CS Fase 2 Restante (Patch 6 T1c, T3)

**CSClienteDetailPage.tsx** — 2 tabs novas:
- Visao Geral: timeline cronologica unificada (deal_activities + lead_messages + cs_surveys + cs_incidents + cs_health_log). Cada item com icone, timestamp, preview. Ordenado por data DESC.
- Atividades/Notas: campo texto livre para CSM + historico de notas

**PipelineConfigPage.tsx** — Tab "Regras Automaticas":
- CRUD de pipeline_auto_rules: stage origem, stage destino, trigger type, config, ativo
- Tabela com edicao inline

### Bloco 13 — Telefonia Avancada (Patch 8 C, D)

**call-transcribe** (Nova edge function):
- Recebe { call_id }
- Download recording_url
- Enviar para API de STT (requer secret — ver nota abaixo)
- Salvar transcription em calls
- Claude gera summary_ia, sentiment, action_items
- Se deal_id: criar deal_activity tipo NOTA com summary
- Se sentiment NEGATIVO + cs_customer: criar cs_incident

**CoachingSidebar.tsx** (MVP com polling HTTP):
- Visivel quando PhoneWidget IN_CALL e maximizado
- Secoes: Deal Context, Framework Cards, Sugestoes
- Polling a cada 15s para edge function call-coach
- Sentimento emoji, talk ratio simplificado

**call-coach** (Nova edge function):
- Recebe { deal_id, transcription_chunk }
- Claude com deal context + knowledge_products + frameworks
- Retorna: sugestoes, objecoes, framework_updates, sentimento

### Bloco 14 — CRON Jobs (SQL Direto)

Novos cron jobs a configurar:
- `deal-scoring-daily` — 0 5 * * *
- `revenue-forecast-daily` — 0 6 * * *
- `weekly-report-sunday` — 0 20 * * 0
- Atualizar `cs-playbook-runner` para `*/30 * * * *`

---

## Dependencias e Segredos

### Segredo Necessario para Transcricao (Bloco 13)
Edge function `call-transcribe` requer API de Speech-to-Text com suporte PT-BR. Opcoes: OpenAI Whisper, Deepgram, AssemblyAI. Sera necessario configurar a chave correspondente antes de implementar o Bloco 13.

### Notas Tecnicas Criticas
1. **Anthropic sempre**: Toda edge function nova usa `api.anthropic.com` com `ANTHROPIC_API_KEY` (ja configurada)
2. **Tabelas novas e types.ts**: Usar `as any` com comentario ate regeneracao dos tipos
3. **config.toml**: Adicionar novas functions: deal-scoring, deal-context-summary, revenue-forecast, weekly-report, call-transcribe, call-coach
4. **RLS**: Todas tabelas novas com RLS + policies baseadas em empresa
5. **Limite 500 deals**: Kanban mantem `.limit(500)`. Ordenacao IA opera sobre esses 500

### Ordem de Implementacao Sugerida
1. Bloco 1 (Schema) — pre-requisito para tudo
2. Bloco 2 (deal-scoring) — base do pipeline inteligente
3. Bloco 9 (Pipeline UI) — visualiza o scoring
4. Bloco 10 (NBA V2) — enriquece workbench
5. Bloco 3 (deal-context-summary) — handoff SDR-Closer
6. Bloco 4 (cs-playbook-runner upgrade) — CS automacao
7. Bloco 12 (CS tabs) — UI para CS
8. Bloco 8 (ClickToCall + PhoneWidget) — telefonia basica
9. Bloco 5 (revenue-forecast) — analytics base
10. Bloco 6 (win-loss upgrade) — analytics IA
11. Bloco 11 (Analytics UI) — dashboard executivo
12. Bloco 7 (weekly-report) — automacao
13. Bloco 14 (CRON) — ativa tudo
14. Bloco 13 (Transcricao + Coaching) — mais complexo, requer STT API key

### Arquivos Impactados (Completo)

| Arquivo | Acao | Bloco |
|---------|------|-------|
| Migration SQL (nova) | Colunas + 3 tabelas + 2 triggers + RLS + indexes | 1 |
| `supabase/functions/deal-scoring/index.ts` | NOVO | 2 |
| `supabase/functions/deal-context-summary/index.ts` | NOVO | 3 |
| `supabase/functions/cs-playbook-runner/index.ts` | REESCREVER | 4 |
| `supabase/functions/revenue-forecast/index.ts` | NOVO | 5 |
| `supabase/functions/deal-loss-analysis/index.ts` | EXPANDIR portfolio | 6 |
| `supabase/functions/weekly-report/index.ts` | NOVO | 7 |
| `supabase/functions/next-best-action/index.ts` | Enriquecer contexto + narrativa | 10 |
| `supabase/functions/zadarma-webhook/index.ts` | Auto-create deal_activity | 8 |
| `supabase/functions/call-transcribe/index.ts` | NOVO | 13 |
| `supabase/functions/call-coach/index.ts` | NOVO | 13 |
| `src/components/zadarma/ClickToCallButton.tsx` | NOVO | 8 |
| `src/components/zadarma/ZadarmaPhoneWidget.tsx` | Hold + deal display + coaching slot | 8 |
| `src/components/zadarma/DealCallsPanel.tsx` | Summary IA + sentiment + transcricao | 8 |
| `src/components/zadarma/CoachingSidebar.tsx` | NOVO | 13 |
| `src/components/pipeline/DealCard.tsx` | Proxima acao + SLA borda + warning dias | 9 |
| `src/components/pipeline/KanbanColumn.tsx` | Toggle ordenacao | 9 |
| `src/components/pipeline/KanbanBoard.tsx` | Urgency sort + toggle state | 9 |
| `src/components/deals/DealDetailSheet.tsx` | Card Insights IA + Card Contexto SDR | 9 |
| `src/components/workbench/NextBestActionCard.tsx` | narrativa_dia | 10 |
| `src/pages/AnalyticsPage.tsx` | Date picker + deltas + tabs velocity/insights | 11 |
| `src/pages/AnalyticsExecutivoPage.tsx` | NOVO — 8 KPIs + sparklines | 11 |
| `src/pages/cs/CSClienteDetailPage.tsx` | 2 tabs novas (Visao Geral + Notas) | 12 |
| `src/pages/PipelineConfigPage.tsx` | Tab Regras Automaticas | 12 |
| `src/components/contacts/ContactDetailSheet.tsx` | ClickToCallButton | 8 |
| `src/pages/LeadDetail.tsx` | ClickToCallButton | 8 |
| `src/App.tsx` | Rota /relatorios/executivo | 11 |
