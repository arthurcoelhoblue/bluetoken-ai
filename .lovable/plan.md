

# Fase 1 — Ligar o Motor (Score 7.2 -> 8.5)

## Status das Tarefas

- **Tarefa 1 (CRON Jobs)**: JA CONCLUIDA. Os 11 jobs ja estao configurados no pg_cron (cadence-runner, cs-health-calculator, cs-nps-auto, cs-churn-predictor, cs-incident-detector, cs-renewal-alerts, cs-daily-briefing, cs-playbook-runner, deal-scoring, revenue-forecast, weekly-report).
- **Tarefa 2**: Criar camada unificada de IA (`_shared/ai-provider.ts`)
- **Tarefa 3**: Migrar copilot-chat para Claude primario com personalidade Amelia
- **Tarefa 4**: Criar tabela `ai_usage_log` + log centralizado
- **Tarefa 5**: Conectar UI de Revenue Forecast ao edge function

---

## Tarefa 2 — Camada Unificada de IA

**Problema**: 13 edge functions implementam chamadas IA com 3 providers (Gemini, Claude, GPT-4o) de forma independente, cada uma com ~50 linhas de logica duplicada de fallback.

**Solucao**: Criar um modulo utilitario compartilhado que encapsula toda a logica.

> NOTA: Edge functions no Supabase nao suportam `_shared/` como import direto. O codigo sera inline em cada function que precisar, mas a logica sera padronizada. Vamos criar o modulo e aplica-lo primeiro no copilot-chat (Tarefa 3) como prova de conceito, depois migrar as demais nas proximas fases.

**Padrao da funcao `callAI`**:
```text
callAI({ system, user, options }) -> { content, model, tokensIn, tokensOut, latencyMs }

Hierarquia:
1. Claude Sonnet 4 (primario) - ANTHROPIC_API_KEY
2. Gemini 3 Pro Preview (fallback) - GOOGLE_API_KEY  
3. GPT-4o (fallback 2) - OPENAI_API_KEY
```

**Impacto**: Todas as funcoes passam a ter logica de fallback consistente, log de uso, e provider primario correto (Claude).

---

## Tarefa 3 — Migrar Copilot-Chat para Claude Primario

**Problema**: O copilot usa Gemini como primario com prompt generico. O SDR-IA usa Claude com 4.126 linhas de prompt sofisticado. A Amelia do copilot fala com voz diferente da Amelia do WhatsApp.

**Solucao**:
1. Inverter a ordem: Claude como primario, Gemini como fallback
2. Enriquecer o system prompt com personalidade da Amelia (tom profissional, foco em acoes praticas, contexto brasileiro, adaptacao por perfil DISC)
3. Adicionar log de uso na tabela `ai_usage_log`

**Arquivo**: `supabase/functions/copilot-chat/index.ts`
- Linhas 208-218: Inverter — Claude primeiro, Gemini fallback
- Linhas 14-29: Expandir SYSTEM_PROMPT com personalidade Amelia

---

## Tarefa 4 — Tabela ai_usage_log + Logging

**Problema**: 15 edge functions chamam APIs de IA sem nenhum registro de custo, latencia ou provider usado. Impossivel saber quanto se gasta ou qual provider performa melhor.

**Solucao**:
1. Criar tabela `ai_usage_log` via migration:
```text
ai_usage_log
  id uuid PK
  function_name text NOT NULL
  provider text NOT NULL (claude/gemini/gpt-4o)
  model text NOT NULL
  tokens_input int
  tokens_output int
  custo_estimado numeric(10,6)
  latency_ms int
  success boolean DEFAULT true
  error_message text
  empresa text
  created_at timestamptz DEFAULT now()
```
2. Adicionar RLS: apenas service role pode inserir, ADMIN pode ler
3. Implementar logging no `copilot-chat` como referencia (inserir na tabela apos cada chamada IA)
4. Tabela de custos estimados por provider/modelo embutida no codigo

---

## Tarefa 5 — Revenue Forecast: Conectar UI ao Edge Function

**Problema**: O edge function `revenue-forecast` gera previsao sofisticada (pipeline + CS + renovacoes) e salva em `system_settings` com key `revenue_forecast`. Mas o `CSRevenueCard` usa `useCSRevenueForecast` que calcula localmente no frontend com dados basicos.

**Solucao**:
1. Criar novo hook `useRevenueForecastEdge` que le de `system_settings` (key=`revenue_forecast`)
2. Atualizar `CSRevenueCard` para usar os dados do edge function quando disponiveis, com fallback para o calculo local atual
3. Os dados do edge function incluem: forecast_30d (pessimista/realista/otimista), pipeline_velocity, avg_close_days — informacoes muito mais ricas que o calculo local

**Arquivos**:
- `src/hooks/useRevenueForecastEdge.ts` (novo)
- `src/components/cs/CSRevenueCard.tsx` (atualizar para mostrar forecast 30d/90d)

---

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/copilot-chat/index.ts` | Inverter provider (Claude primario), expandir prompt, adicionar log |
| `src/hooks/useRevenueForecastEdge.ts` | Novo hook para ler forecast do backend |
| `src/components/cs/CSRevenueCard.tsx` | Usar dados do edge function + mostrar forecast 30d/90d |
| Migration SQL | Criar tabela `ai_usage_log` com RLS |

## Ordem de Execucao

1. Migration: criar `ai_usage_log`
2. Editar `copilot-chat`: inverter providers + prompt Amelia + log de uso
3. Deploy `copilot-chat`
4. Criar `useRevenueForecastEdge` + atualizar `CSRevenueCard`

