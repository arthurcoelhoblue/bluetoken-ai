

# Correção: Limpeza de CRON Jobs Duplicados

## Diagnóstico

Os CRON jobs **existem e estão funcionando** — a auditoria V5 foi escrita antes da implementação. Porém, a investigação revelou um problema real: **10 jobs duplicados** no banco de dados.

Existem 26 jobs no total quando deveriam ser 16. A causa: os jobs foram criados em dois momentos distintos (duas rodadas de SQL), resultando em pares como:

```text
cadence-runner          (*/15 * * * *)  -- rodada 1
cadence-runner-15min    (*/15 * * * *)  -- rodada 2 (DUPLICADO)

deal-scoring-daily      (0 5 * * *)    -- rodada 1
deal-scoring-6h         (0 */6 * * *)  -- rodada 2 (horário diferente!)
```

### Impacto dos duplicados:
- Funções de IA sendo chamadas 2x, dobrando custos de tokens
- Possíveis conflitos de concorrência (ex: dois cadence-runner simultâneos)
- Dados de telemetria inflados

## Plano de Correção

### Passo 1: Remover os 10 jobs duplicados

Identificação dos duplicados a remover (manter os da rodada original que têm nomes mais limpos):

| Job a REMOVER (duplicado) | Job a MANTER (original) |
|---------------------------|------------------------|
| `cadence-runner-15min` (jobid 35) | `cadence-runner` (jobid 30) |
| `cs-health-calculator-daily-6h` (jobid 43) | `cs-health-calculator` (jobid 24) |
| `cs-churn-predictor-daily-630` (jobid 44) | `cs-churn-predictor` (jobid 26) |
| `cs-daily-briefing-daily-830` (jobid 47) | `cs-daily-briefing` (jobid 29) |
| `cs-incident-detector-2h` (jobid 37) | `cs-incident-detector` (jobid 27) |
| `cs-nps-auto-daily-7h` (jobid 45) | `cs-nps-auto` (jobid 25) |
| `cs-renewal-alerts-daily-8h` (jobid 46) | `cs-renewal-alerts` (jobid 28) |
| `deal-scoring-6h` (jobid 39) | `deal-scoring-daily` (jobid 31) |
| `revenue-forecast-daily-5h` (jobid 42) | `revenue-forecast-daily` (jobid 32) |
| `weekly-report-sunday-20h` (jobid 49) | `weekly-report-sunday` (jobid 33) |

### Passo 2: Verificar schedules dos jobs mantidos

Garantir que os 16 jobs restantes tenham os horários corretos conforme a auditoria recomenda:

| Funcao | Schedule correto |
|--------|-----------------|
| cadence-runner | `*/15 * * * *` (a cada 15 min) |
| cs-health-calculator | `0 6 * * *` (diario 6h) |
| cs-churn-predictor | `0 7 * * *` (diario 7h) -- NOTA: duplicado tinha `30 6`, original tem `0 7` |
| cs-daily-briefing | `30 8 * * *` (diario 8:30) |
| cs-incident-detector | `0 */2 * * *` (a cada 2h) |
| cs-nps-auto | `0 9 * * *` (diario 9h) |
| cs-renewal-alerts | `0 8 * * *` (diario 8h) |
| cs-playbook-runner | `*/30 * * * *` (a cada 30 min) |
| copilot-proactive | `0 */4 * * *` (a cada 4h) |
| deal-scoring | `0 5 * * *` (diario 5h) |
| follow-up-scheduler | `0 4 * * *` (diario 4h) |
| icp-learner | `0 3 * * 0` (domingo 3h) |
| integration-health-check | `*/5 * * * *` (a cada 5 min) |
| revenue-forecast | `0 6 * * *` (diario 6h) |
| weekly-report | `0 20 * * 0` (domingo 20h) |
| cleanup-rate-limits | `0 2 * * *` (diario 2h) |

## Detalhe Tecnico

A remoção dos duplicados sera feita via SQL direto (não migration, pois os jobs foram criados via SQL direto):

```text
SELECT cron.unschedule('cadence-runner-15min');
SELECT cron.unschedule('cs-health-calculator-daily-6h');
SELECT cron.unschedule('cs-churn-predictor-daily-630');
SELECT cron.unschedule('cs-daily-briefing-daily-830');
SELECT cron.unschedule('cs-incident-detector-2h');
SELECT cron.unschedule('cs-nps-auto-daily-7h');
SELECT cron.unschedule('cs-renewal-alerts-daily-8h');
SELECT cron.unschedule('deal-scoring-6h');
SELECT cron.unschedule('revenue-forecast-daily-5h');
SELECT cron.unschedule('weekly-report-sunday-20h');
```

Após a limpeza, verificar com `SELECT * FROM cron.job` que restam exatamente 16 jobs.

### Resposta para o PO

O item CRON da auditoria V5 **já está resolvido** — os 16 jobs estão ativos e executando com sucesso (última execução: agora mesmo). O documento da auditoria foi escrito antes da implementação. O que encontramos e vamos corrigir agora são **10 jobs duplicados** que foram criados acidentalmente em uma segunda rodada de SQL, o que pode estar dobrando custos de IA desnecessariamente.

## Arquivos modificados

Nenhum arquivo de código sera alterado. Apenas execução de SQL para remover duplicados do `cron.job`.
