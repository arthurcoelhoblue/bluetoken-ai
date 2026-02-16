
# Item 1.1 — Versionar 16 CRON jobs em migration SQL

## Objetivo

Criar uma migration SQL que versiona todos os 16 CRON jobs ativos, garantindo reprodutibilidade em staging e disaster recovery. Atualmente esses jobs existem apenas no banco de producao, sem nenhum registro em codigo.

## 16 Jobs Mapeados

| # | Job Name | Schedule | Funcao |
|---|----------|----------|--------|
| 1 | cadence-runner | `*/15 * * * *` | Motor de cadencias (a cada 15min) |
| 2 | cleanup-rate-limits-daily | `0 2 * * *` | Limpa rate limits antigos (2h) |
| 3 | copilot-proactive-4h | `0 */4 * * *` | Copilot proativo (a cada 4h) |
| 4 | cs-churn-predictor | `0 7 * * *` | Predicao de churn (7h) |
| 5 | cs-daily-briefing | `30 8 * * *` | Briefing diario CS (8:30) |
| 6 | cs-health-calculator | `0 6 * * *` | Calculo health score (6h) |
| 7 | cs-incident-detector | `0 */2 * * *` | Detector de incidencias (a cada 2h) |
| 8 | cs-nps-auto | `0 9 * * *` | NPS automatico (9h) |
| 9 | cs-playbook-runner-30min | `*/30 * * * *` | Playbooks CS (a cada 30min) |
| 10 | cs-renewal-alerts | `0 8 * * *` | Alertas de renovacao (8h) |
| 11 | deal-scoring-daily | `0 5 * * *` | Scoring de deals (5h) |
| 12 | follow-up-scheduler-daily-4h | `0 4 * * *` | Follow-up scheduler (4h) |
| 13 | icp-learner-sunday-3h | `0 3 * * 0` | ICP learner (domingos 3h) |
| 14 | integration-health-5min | `*/5 * * * *` | Health check integracoes (5min) |
| 15 | revenue-forecast-daily | `0 6 * * *` | Previsao de receita (6h) |
| 16 | weekly-report-sunday | `0 20 * * 0` | Relatorio semanal (domingos 20h) |

## Implementacao

**Nota importante**: Conforme as instrucoes do sistema, migrations com dados especificos do projeto (URLs e anon key) **nao devem ser criadas como migration file**. Em vez disso, vou:

1. **Criar um arquivo de documentacao** `docs/patches/PATCH-CRON-VERSIONING.md` com todos os 16 `SELECT cron.schedule(...)` prontos para execucao
2. **Executar via SQL direto** no banco para garantir que estejam ativos (ja estao, mas o versionamento fica documentado)
3. **Atualizar o plan.md** marcando o item 1.1 como concluido

## Detalhes tecnicos

O SQL de cada job segue o padrao:

```text
SELECT cron.schedule(
  'job-name',
  'cron-expression',
  $$
  SELECT net.http_post(
    url:='https://[project-ref].supabase.co/functions/v1/[function-name]',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

O job `cleanup-rate-limits-daily` e o unico que executa SQL direto (DELETE) em vez de chamar uma edge function.

A migration usara `SELECT cron.unschedule(name)` antes de cada `cron.schedule()` para ser idempotente (pode rodar multiplas vezes sem duplicar jobs).

## Impacto

- Zero impacto em runtime (jobs ja existem e continuam funcionando)
- Garante reprodutibilidade: qualquer novo ambiente pode recriar os jobs executando o documento
- Atende ao requisito do parecer de auditoria (prioridade MEDIA)
