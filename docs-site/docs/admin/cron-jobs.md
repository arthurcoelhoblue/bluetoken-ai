---
sidebar_position: 8
title: CRON Jobs
---

# CRON Jobs — Automação Agendada

Tarefas que rodam automaticamente no servidor:

| Job | Frequência | Descrição |
|:--|:--|:--|
| `cadence-runner` | A cada 15 min | Processa próximos passos das cadências ativas |
| `deal-reconciler` | A cada 10 min | Reconcilia falhas na criação automática de deals |
| `cs-health-calculator` | Diário às 6h | Recalcula Health Score de todos os clientes |
| `cs-churn-predictor` | Diário às 7h | Roda modelo de predição de churn |
| `cs-daily-briefing` | Diário às 8h | Gera resumo diário para equipe de CS |
| `weekly-report` | Domingos às 20h | Compila relatório semanal de vendas |

:::info Monitoramento
Falhas nos CRON jobs são registradas automaticamente e geram alertas na tela de Saúde Operacional.
:::
