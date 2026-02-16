# PATCH — Versionamento dos 16 CRON Jobs

## Metadados
- **Data**: 2026-02-16
- **Épico**: Infraestrutura / Observabilidade
- **Status**: ✅ Documentado e ativo
- **Prioridade Auditoria**: MÉDIA

---

## 1. Objetivo

Versionar todos os 16 CRON jobs ativos do sistema, garantindo reprodutibilidade em staging, disaster recovery e onboarding de novos ambientes.

---

## 2. Como Usar

Para recriar todos os jobs em um novo ambiente, execute os blocos SQL abaixo no SQL Editor. Substitua:
- `[PROJECT_REF]` → ID do projeto Supabase (ex: `xdjvlcelauvibznnbrzb`)
- `[ANON_KEY]` → Chave anon do projeto

Os comandos são idempotentes — podem ser executados múltiplas vezes sem duplicar jobs.

---

## 3. Pré-requisitos

```sql
-- Garantir extensões habilitadas
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

---

## 4. Os 16 Jobs

### 4.1 cadence-runner (a cada 15min)
```sql
SELECT cron.unschedule('cadence-runner');
SELECT cron.schedule(
  'cadence-runner',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://[PROJECT_REF].supabase.co/functions/v1/cadence-runner',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 4.2 cleanup-rate-limits-daily (02:00)
```sql
SELECT cron.unschedule('cleanup-rate-limits-daily');
SELECT cron.schedule(
  'cleanup-rate-limits-daily',
  '0 2 * * *',
  $$
  DELETE FROM public.ai_rate_limits WHERE window_start < now() - interval '24 hours';
  $$
);
```

### 4.3 copilot-proactive-4h (a cada 4h)
```sql
SELECT cron.unschedule('copilot-proactive-4h');
SELECT cron.schedule(
  'copilot-proactive-4h',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url:='https://[PROJECT_REF].supabase.co/functions/v1/copilot-proactive',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 4.4 cs-churn-predictor (07:00)
```sql
SELECT cron.unschedule('cs-churn-predictor');
SELECT cron.schedule(
  'cs-churn-predictor',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url:='https://[PROJECT_REF].supabase.co/functions/v1/cs-churn-predictor',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 4.5 cs-daily-briefing (08:30)
```sql
SELECT cron.unschedule('cs-daily-briefing');
SELECT cron.schedule(
  'cs-daily-briefing',
  '30 8 * * *',
  $$
  SELECT net.http_post(
    url:='https://[PROJECT_REF].supabase.co/functions/v1/cs-daily-briefing',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 4.6 cs-health-calculator (06:00)
```sql
SELECT cron.unschedule('cs-health-calculator');
SELECT cron.schedule(
  'cs-health-calculator',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url:='https://[PROJECT_REF].supabase.co/functions/v1/cs-health-calculator',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 4.7 cs-incident-detector (a cada 2h)
```sql
SELECT cron.unschedule('cs-incident-detector');
SELECT cron.schedule(
  'cs-incident-detector',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url:='https://[PROJECT_REF].supabase.co/functions/v1/cs-incident-detector',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 4.8 cs-nps-auto (09:00)
```sql
SELECT cron.unschedule('cs-nps-auto');
SELECT cron.schedule(
  'cs-nps-auto',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url:='https://[PROJECT_REF].supabase.co/functions/v1/cs-nps-auto',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 4.9 cs-playbook-runner-30min (a cada 30min)
```sql
SELECT cron.unschedule('cs-playbook-runner-30min');
SELECT cron.schedule(
  'cs-playbook-runner-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url:='https://[PROJECT_REF].supabase.co/functions/v1/cs-playbook-runner',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 4.10 cs-renewal-alerts (08:00)
```sql
SELECT cron.unschedule('cs-renewal-alerts');
SELECT cron.schedule(
  'cs-renewal-alerts',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url:='https://[PROJECT_REF].supabase.co/functions/v1/cs-renewal-alerts',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 4.11 deal-scoring-daily (05:00)
```sql
SELECT cron.unschedule('deal-scoring-daily');
SELECT cron.schedule(
  'deal-scoring-daily',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url:='https://[PROJECT_REF].supabase.co/functions/v1/deal-scoring',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 4.12 follow-up-scheduler-daily-4h (04:00)
```sql
SELECT cron.unschedule('follow-up-scheduler-daily-4h');
SELECT cron.schedule(
  'follow-up-scheduler-daily-4h',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url:='https://[PROJECT_REF].supabase.co/functions/v1/follow-up-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 4.13 icp-learner-sunday-3h (domingos 03:00)
```sql
SELECT cron.unschedule('icp-learner-sunday-3h');
SELECT cron.schedule(
  'icp-learner-sunday-3h',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
    url:='https://[PROJECT_REF].supabase.co/functions/v1/icp-learner',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 4.14 integration-health-5min (a cada 5min)
```sql
SELECT cron.unschedule('integration-health-5min');
SELECT cron.schedule(
  'integration-health-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://[PROJECT_REF].supabase.co/functions/v1/integration-health-check',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 4.15 revenue-forecast-daily (06:00)
```sql
SELECT cron.unschedule('revenue-forecast-daily');
SELECT cron.schedule(
  'revenue-forecast-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url:='https://[PROJECT_REF].supabase.co/functions/v1/revenue-forecast',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 4.16 weekly-report-sunday (domingos 20:00)
```sql
SELECT cron.unschedule('weekly-report-sunday');
SELECT cron.schedule(
  'weekly-report-sunday',
  '0 20 * * 0',
  $$
  SELECT net.http_post(
    url:='https://[PROJECT_REF].supabase.co/functions/v1/weekly-report',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{"source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);
```

---

## 5. Resumo

| # | Job | Schedule | Tipo |
|---|-----|----------|------|
| 1 | cadence-runner | `*/15 * * * *` | Edge Function |
| 2 | cleanup-rate-limits-daily | `0 2 * * *` | SQL direto |
| 3 | copilot-proactive-4h | `0 */4 * * *` | Edge Function |
| 4 | cs-churn-predictor | `0 7 * * *` | Edge Function |
| 5 | cs-daily-briefing | `30 8 * * *` | Edge Function |
| 6 | cs-health-calculator | `0 6 * * *` | Edge Function |
| 7 | cs-incident-detector | `0 */2 * * *` | Edge Function |
| 8 | cs-nps-auto | `0 9 * * *` | Edge Function |
| 9 | cs-playbook-runner-30min | `*/30 * * * *` | Edge Function |
| 10 | cs-renewal-alerts | `0 8 * * *` | Edge Function |
| 11 | deal-scoring-daily | `0 5 * * *` | Edge Function |
| 12 | follow-up-scheduler-daily-4h | `0 4 * * *` | Edge Function |
| 13 | icp-learner-sunday-3h | `0 3 * * 0` | Edge Function |
| 14 | integration-health-5min | `*/5 * * * *` | Edge Function |
| 15 | revenue-forecast-daily | `0 6 * * *` | Edge Function |
| 16 | weekly-report-sunday | `0 20 * * 0` | Edge Function |

---

## 6. Verificação

```sql
-- Listar todos os jobs ativos
SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;

-- Histórico de execuções recentes
SELECT jobname, status, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```
