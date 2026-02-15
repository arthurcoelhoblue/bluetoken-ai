

# Plano de Acao: Item 8 do Parecer V4 — V4 para Producao em 3 Dias

Este plano implementa todas as 12 acoes descritas no Item 8 do relatorio V4, organizadas em 3 dias.

---

## DIA 1 — Ligar o Motor (BLOQUEANTES + ALTO)

### Acao 1: CRON jobs para 13 edge functions

Criar uma migration SQL usando `cron.schedule()` para agendar todas as 13 funcoes periodicas.

| Edge Function | Frequencia | Horario |
|---|---|---|
| cadence-runner | Cada 15 min | */15 * * * * |
| cs-playbook-runner | Cada 30 min | */30 * * * * |
| cs-incident-detector | Cada 2h | 0 */2 * * * |
| copilot-proactive | Cada 4h | 0 */4 * * * |
| deal-scoring | Cada 6h | 0 */6 * * * |
| follow-up-scheduler | Diario 4h | 0 4 * * * |
| revenue-forecast | Diario 5h | 0 5 * * * |
| cs-health-calculator | Diario 6h | 0 6 * * * |
| cs-churn-predictor | Diario 6h30 | 30 6 * * * |
| cs-nps-auto | Diario 7h | 0 7 * * * |
| cs-renewal-alerts | Diario 8h | 0 8 * * * |
| icp-learner | Domingo 3h | 0 3 * * 0 |
| weekly-report | Domingo 20h | 0 20 * * 0 |

Cada job chamara `net.http_post` para invocar a edge function via URL completa com `Authorization: Bearer` usando a anon key.

### Acao 2: Deals com paginacao real

Modificar `src/hooks/useDeals.ts`:
- Adicionar `PAGE_SIZE = 50`
- Aceitar parametro `page` no hook `useDeals`
- Usar `.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)` (mesmo padrao de `useContactsPage`)
- Adicionar `{ count: 'exact' }` ao select
- Retornar `{ data, count }` ao inves de apenas array

Modificar `src/components/pipeline/KanbanBoard.tsx` se necessario para lidar com paginacao (ou manter carregamento completo apenas para Kanban, com paginacao em views de lista).

Nota: como o Kanban precisa de todos os deals para montar as colunas, a paginacao sera aplicada em contextos de listagem. Para o Kanban, adicionar `.limit(500)` como trava de seguranca.

### Acao 3: ai_usage_log em 15 edge functions restantes

Adicionar insert na tabela `ai_usage_log` apos cada chamada de IA nas 15 funcoes que nao logam:

| Funcao | Provider Atual |
|---|---|
| sdr-ia-interpret | Claude |
| deal-scoring | Gemini/Claude/OpenAI |
| next-best-action | Claude |
| call-coach | Claude/Gemini |
| call-transcribe | OpenAI/Gemini/Claude |
| copilot-proactive | Claude |
| cs-daily-briefing | Gemini/Claude/OpenAI |
| cs-trending-topics | Gemini/Claude/OpenAI |
| deal-context-summary | Gemini/Claude/OpenAI |
| deal-loss-analysis | Gemini/Claude |
| weekly-report | Claude/Gemini |
| amelia-learn | Gemini/Claude |
| amelia-mass-action | Gemini/Claude |
| ai-benchmark | Gemini/Claude |
| integration-health-check | N/A (sem IA) |

Template de insert (adaptar por funcao):

```typescript
const startMs = Date.now();
// ... chamada IA ...
const latencyMs = Date.now() - startMs;
await supabase.from('ai_usage_log').insert({
  function_name: 'NOME_FUNCAO',
  provider: 'CLAUDE', // ou GEMINI, OPENAI
  model: 'claude-sonnet-4-20250514',
  tokens_input: null, // se disponivel
  tokens_output: null,
  success: true,
  latency_ms: latencyMs,
  custo_estimado: 0,
  empresa: empresa || null,
});
```

`integration-health-check` nao usa IA, portanto nao precisa de logging IA.

### Acao 4: useAnalyticsEvents em 10 componentes criticos

Instrumentar tracking nos seguintes componentes/paginas:

| Componente | Evento |
|---|---|
| CopilotPanel.tsx | `copilot_opened`, `copilot_message_sent` |
| WorkbenchPage.tsx | `page_view:workbench` |
| DealInsightsTab.tsx | `feature:deal_insights_viewed` |
| CSClienteDetailPage.tsx | `page_view:cs_cliente_detail` |
| PipelinePage.tsx | `page_view:pipeline` |
| ConversasPage.tsx | `page_view:conversas` |
| AnalyticsPage.tsx | `page_view:analytics` |
| EmailFromDealDialog.tsx | `feature:email_from_deal` |
| NextBestActionCard.tsx | `feature:nba_action_clicked` |
| LeadDetail.tsx | `page_view:lead_detail` |

Padrao: importar `useAnalyticsEvents`, chamar `trackPageView` no useEffect de mount, ou `trackFeatureUse` no handler de clique.

---

## DIA 2 — Consistencia IA + UI Conectada

### Acao 5: 4 funcoes Gemini para Claude primary

Migrar para Claude como provider primario (Gemini vira fallback) nas funcoes:

| Funcao | Linhas a alterar |
|---|---|
| deal-scoring | Inverter ordem: Claude primeiro, Gemini fallback |
| cs-daily-briefing | Inverter ordem: Claude primeiro, Gemini fallback |
| deal-context-summary | Inverter ordem: Claude primeiro, Gemini fallback |
| cs-trending-topics | Inverter ordem: Claude primeiro, Gemini fallback |

Padrao: mover bloco Claude antes do bloco Gemini em cada funcao.

### Acao 6: faq-auto-review e icp-learner — adicionar Claude primary

- `faq-auto-review`: atualmente so usa Gemini sem fallback. Adicionar Claude como primary com system prompt separado, Gemini vira fallback.
- `icp-learner`: atualmente usa `gemini-2.5-flash` sem fallback. Adicionar Claude primary, mover Gemini para fallback.

### Acao 7: FollowUpHintCard no DealDetailSheet

Criar componente `src/components/deals/FollowUpHintCard.tsx`:
- Usa `useFollowUpHours` com empresa do deal
- Mostra card com icone de relogio
- Texto: "Melhor horario para contato: Terca 9h, 73% taxa resposta"
- Se sem dados: "Sem dados de follow-up calculados"
- Integrar na aba principal do DealDetailSheet (abaixo das infos do deal)

### Acao 8: IcpInsightsCard no AnalyticsExecutivoPage

Criar componente `src/components/analytics/IcpInsightsCard.tsx`:
- Busca `system_settings` com key `icp_profile`
- Mostra: resumo ICP narrativo, setores ideais, cargos ideais, canais top, red flags
- Se sem dados: botao "Calcular ICP" que invoca `icp-learner`
- Integrar no `AnalyticsExecutivoPage.tsx`

### Acao 9: prompt_versions em copilot-chat e sdr-ia-interpret

Modificar as 2 edge functions para:
1. No inicio, buscar prompt ativo: `SELECT content FROM prompt_versions WHERE function_name = 'X' AND prompt_key = 'system' AND is_active = true LIMIT 1`
2. Se encontrar, usar como SYSTEM_PROMPT
3. Se nao encontrar (fallback), usar o prompt inline hardcoded atual
4. Isto permite A/B testing e versionamento sem deploy

---

## DIA 3 — Protecao e Resiliencia

### Acao 10: Camada unificada _shared/ai-provider.ts

Nao e possivel criar arquivos compartilhados entre edge functions no Supabase (cada funcao e isolada). A alternativa e:
- Criar um helper `callAI()` inline em cada funcao que precisa (ja existe em `deal-loss-analysis` e `amelia-learn`)
- Padronizar o helper com: Claude primary, Gemini fallback, GPT-4o fallback 2, logging automatico em `ai_usage_log`
- Refatorar `copilot-chat` e `deal-scoring` como piloto usando este padrao unificado

O helper padrao tera ~60 linhas e sera copiado nas funcoes que ainda usam fetch direto sem padrao.

### Acao 11: Rate limiting para chamadas IA

Criar migration com tabela `ai_rate_limits`:
```sql
CREATE TABLE ai_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  function_name text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  call_count int NOT NULL DEFAULT 1,
  UNIQUE(user_id, function_name, window_start)
);
```

Adicionar check antes de chamadas IA nas funcoes interativas (copilot-chat, deal-scoring on-demand):
- Limite: 50 calls/user/hour para copilot
- Limite: 200 calls/function/hour para batch
- Se excedido: retornar 429 com mensagem amigavel

### Acao 12: Health check no CRON cada 5min

Adicionar ao CRON da Acao 1: `integration-health-check` a cada 5 minutos.
Modificar `integration-health-check` para:
- Apos rodar checks, se alguma integracao falhar 3x consecutivas, criar notificacao para ADMINs
- Buscar admins via `user_roles` onde `role = 'ADMIN'`
- Inserir `notifications` com tipo `SYSTEM_ALERT`

---

## Resumo de Arquivos

### Arquivos a criar (novos)

| Arquivo | Descricao |
|---|---|
| `src/components/deals/FollowUpHintCard.tsx` | Card com melhor horario de contato |
| `src/components/analytics/IcpInsightsCard.tsx` | Card com perfil ICP aprendido |

### Migration SQL

Uma migration com:
- CRON jobs para 14 funcoes (13 originais + health-check cada 5min)
- Tabela `ai_rate_limits`

### Edge functions a modificar (14 funcoes)

| Funcao | Mudancas |
|---|---|
| deal-scoring | Claude primary + ai_usage_log |
| cs-daily-briefing | Claude primary + ai_usage_log |
| deal-context-summary | Claude primary + ai_usage_log |
| cs-trending-topics | Claude primary + ai_usage_log |
| faq-auto-review | Claude primary + Gemini fallback + ai_usage_log (ja loga parcialmente) |
| icp-learner | Claude primary + Gemini fallback |
| sdr-ia-interpret | ai_usage_log + prompt_versions |
| next-best-action | ai_usage_log |
| call-coach | ai_usage_log |
| call-transcribe | ai_usage_log |
| copilot-proactive | ai_usage_log |
| copilot-chat | ai_usage_log (ja loga) + prompt_versions |
| deal-loss-analysis | ai_usage_log |
| weekly-report | ai_usage_log |
| amelia-learn | ai_usage_log |
| amelia-mass-action | ai_usage_log |
| ai-benchmark | ai_usage_log |
| integration-health-check | Alerta admin 3x falha consecutiva |

### Componentes frontend a modificar (12 arquivos)

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useDeals.ts` | Paginacao PAGE_SIZE=50 + limit(500) para Kanban |
| `src/components/copilot/CopilotPanel.tsx` | useAnalyticsEvents tracking |
| `src/pages/WorkbenchPage.tsx` | useAnalyticsEvents tracking |
| `src/components/deals/DealInsightsTab.tsx` | useAnalyticsEvents tracking |
| `src/pages/cs/CSClienteDetailPage.tsx` | useAnalyticsEvents tracking |
| `src/pages/PipelinePage.tsx` | useAnalyticsEvents tracking |
| `src/pages/ConversasPage.tsx` | useAnalyticsEvents tracking |
| `src/pages/AnalyticsPage.tsx` | useAnalyticsEvents tracking |
| `src/components/deals/EmailFromDealDialog.tsx` | useAnalyticsEvents tracking |
| `src/components/workbench/NextBestActionCard.tsx` | useAnalyticsEvents tracking |
| `src/pages/LeadDetail.tsx` | useAnalyticsEvents tracking |
| `src/components/deals/DealDetailSheet.tsx` | Integrar FollowUpHintCard |
| `src/pages/AnalyticsExecutivoPage.tsx` | Integrar IcpInsightsCard |

---

## Ordem de Execucao Recomendada

Como sao muitas mudancas, recomendo implementar em lotes:

**Lote 1** (Bloqueante): Migration CRON + rate limits + paginacao deals
**Lote 2** (Alto): ai_usage_log em 14 edge functions + migracao Claude primary em 6 funcoes
**Lote 3** (Medio): Analytics events em 10 componentes + FollowUpHintCard + IcpInsightsCard
**Lote 4** (Medio): prompt_versions em copilot-chat e sdr-ia-interpret + health-check alertas + helper callAI padronizado

