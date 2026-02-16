---
sidebar_position: 8
title: Referência de APIs
---

# Referência de APIs (Edge Functions)

## IA e Qualificação

| Endpoint | Método | Descrição |
|:--|:--|:--|
| `/sdr-ia-interpret` | POST | Interpreta mensagem de lead |
| `/sdr-response-generator` | POST | Gera resposta para lead |
| `/sdr-intent-classifier` | POST | Classifica intenção da mensagem |
| `/sdr-message-parser` | POST | Parsing estruturado de mensagem |
| `/deal-scoring` | POST | Calcula score de probabilidade |
| `/deal-context-summary` | POST | Gera resumo contextual do deal |
| `/reclassify-leads` | POST | Reclassifica leads em lote |

## CS e Saúde

| Endpoint | Método | Descrição |
|:--|:--|:--|
| `/cs-health-calculator` | POST | Recalcula Health Scores |
| `/cs-churn-predictor` | POST | Predição de churn |
| `/cs-daily-briefing` | POST | Gera briefing diário |
| `/cs-incident-detector` | POST | Detecta incidências |
| `/cs-nps-auto` | POST | Envio automático de NPS |
| `/cs-suggest-note` | POST | Sugere nota para cliente |

## Comunicação

| Endpoint | Método | Descrição |
|:--|:--|:--|
| `/whatsapp-send` | POST | Envia WhatsApp |
| `/email-send` | POST | Envia e-mail |
| `/cadence-runner` | POST | Processa cadências |

## Copilot e Relatórios

| Endpoint | Método | Descrição |
|:--|:--|:--|
| `/copilot-chat` | POST | Chat com Amélia Copilot |
| `/copilot-proactive` | POST | Insights proativos |
| `/weekly-report` | POST | Relatório semanal |
| `/revenue-forecast` | POST | Previsão de receita |
