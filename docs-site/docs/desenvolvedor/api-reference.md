---
sidebar_position: 8
title: Referência de APIs
---

# Referência de APIs (Edge Functions)

Documentação completa de todas as Edge Functions do sistema. Após consolidação seletiva, o sistema opera com **35 funções deployadas** + módulos compartilhados.

---

## SDR e IA de Qualificação

| Endpoint | Método | Descrição | Auth |
|:--|:--|:--|:--|
| `/sdr-ia-interpret` | POST | Orquestrador principal do pipeline SDR. Interpreta mensagem, classifica intenção, gera resposta e executa ações — tudo em chamada única. | Service Role |
| `/reclassify-leads` | POST | Reclassifica leads em lote com IA | Bearer Token |
| `/deal-scoring` | POST | Calcula score de probabilidade do deal | Service Role |
| `/deal-context-summary` | POST | Gera resumo contextual do deal com IA | Bearer Token |
| `/deal-loss-analysis` | POST | Analisa motivos de perda de deals | Bearer Token |
| `/next-best-action` | POST | Sugere próxima melhor ação para deal | Bearer Token |

### `sdr-ia-interpret` (Orquestrador SDR)

Módulos internalizados (não deployados separadamente):
- `message-parser.ts` — Parsing de contexto e urgência
- `intent-classifier.ts` — Classificação de intenção com frameworks de vendas
- `response-generator.ts` — Geração e sanitização de resposta
- `action-executor.ts` — Execução de ações e sincronização no banco

**Body:**
```json
{
  "message_id": "uuid",
  "lead_id": "uuid",
  "empresa": "BLUE",
  "message_text": "Quero saber sobre os planos",
  "canal": "WHATSAPP"
}
```

---

## Customer Success — Ações sob demanda

| Endpoint | Método | Descrição | Auth |
|:--|:--|:--|:--|
| `/cs-ai-actions` | POST | Ações CS sob demanda (roteamento por `action`) | Bearer Token |
| `/cs-health-calculator` | POST | Recalcula Health Score de clientes | Service Role |
| `/cs-playbook-runner` | POST | Executa playbooks automatizados de CS | Service Role |

### `cs-ai-actions` — Ações disponíveis

| action | Descrição | Parâmetros |
|:--|:--|:--|
| `suggest-note` | Gera sugestão de nota de acompanhamento via IA | `customer_id` |
| `churn-predict` | Recalcula risco de churn de todos os clientes ativos | — |
| `detect-incidents` | Detecta incidências por sentimento negativo consecutivo | — |

**Exemplo:**
```json
{ "action": "suggest-note", "customer_id": "uuid" }
```

---

## Customer Success — Jobs Agendados

| Endpoint | Método | Descrição | Auth |
|:--|:--|:--|:--|
| `/cs-scheduled-jobs` | POST | Jobs CS agendados (roteamento por `action`) | Service Role / CRON |

### `cs-scheduled-jobs` — Ações disponíveis

| action | Descrição | Parâmetros |
|:--|:--|:--|
| `daily-briefing` | Gera briefing diário para cada CSM | `empresa` (opcional) |
| `nps-auto` | Envia pesquisa NPS/CSAT automática | `tipo`, `customer_id` (opcional) |
| `renewal-alerts` | Alerta renovações em 15/30/60 dias | — |
| `trending-topics` | Analisa tópicos recorrentes em pesquisas | — |

**Exemplo:**
```json
{ "action": "nps-auto", "customer_id": "uuid", "tipo": "CSAT" }
```

---

## Comunicação

| Endpoint | Método | Descrição | Auth |
|:--|:--|:--|:--|
| `/whatsapp-send` | POST | Envia mensagem via WhatsApp (BlueChat) | Service Role |
| `/whatsapp-inbound` | POST | Recebe mensagens inbound do WhatsApp | Webhook |
| `/email-send` | POST | Envia e-mail via SMTP | Service Role |
| `/cadence-runner` | POST | Processa cadências ativas (CRON) | Service Role |
| `/notify-closer` | POST | Notifica closer sobre lead qualificado | Service Role |

---

## Copilot e Relatórios

| Endpoint | Método | Descrição | Auth |
|:--|:--|:--|:--|
| `/copilot-chat` | POST | Chat com Amélia Copilot (streaming) | Bearer Token |
| `/copilot-proactive` | POST | Gera insights proativos por vendedor | Service Role |
| `/weekly-report` | POST | Relatório semanal consolidado | Service Role |
| `/revenue-forecast` | POST | Previsão de receita com IA | Service Role |
| `/follow-up-scheduler` | POST | Agenda follow-ups automáticos | Service Role |

---

## Amelia IA e Aprendizado

| Endpoint | Método | Descrição | Auth |
|:--|:--|:--|:--|
| `/amelia-learn` | POST | Extrai aprendizados de padrões de vendas | Service Role |
| `/amelia-mass-action` | POST | Executa ações em massa (reclassificação, disparo) | Bearer Token |
| `/ai-benchmark` | POST | Benchmarks de modelos de IA | Service Role |
| `/icp-learner` | POST | Aprende perfil ideal de cliente (ICP) | Service Role |
| `/faq-auto-review` | POST | Revisão automática de FAQs do conhecimento | Service Role |

---

## Webhooks e Integrações Externas

| Endpoint | Método | Descrição | Auth |
|:--|:--|:--|:--|
| `/sgt-webhook` | POST | Webhook inbound do SGT (tráfego) | HMAC SHA-256 |
| `/bluechat-inbound` | POST | Webhook inbound do BlueChat (WhatsApp) | HMAC SHA-256 |
| `/sgt-buscar-lead` | POST | Busca lead no SGT | Service Role |
| `/sgt-sync-clientes` | POST | Sincroniza clientes com SGT | Service Role |
| `/pipedrive-sync` | POST | Sincronização com Pipedrive | Service Role |
| `/integration-health-check` | POST | Verifica saúde das integrações | Service Role |

---

## Telefonia (Zadarma)

| Endpoint | Método | Descrição | Auth |
|:--|:--|:--|:--|
| `/zadarma-proxy` | POST | Proxy de chamadas via Zadarma PBX | Bearer Token |
| `/zadarma-webhook` | POST | Webhook de eventos de chamada | Webhook |
| `/call-coach` | POST | Coaching de chamadas com IA | Bearer Token |
| `/call-transcribe` | POST | Transcrição de chamadas | Service Role |

---

## Formulários e Ofertas

| Endpoint | Método | Descrição | Auth |
|:--|:--|:--|:--|
| `/capture-form-submit` | POST | Submissão de formulários de captura | Anon (público) |
| `/tokeniza-offers` | POST | Gerencia ofertas Tokeniza | Bearer Token |

---

## Admin

| Endpoint | Método | Descrição | Auth |
|:--|:--|:--|:--|
| `/admin-create-user` | POST | Cria usuário com role atribuída | Bearer Token (Admin) |

---

## Arquitetura de Consolidação

### Funções internalizadas (não deployadas)

As seguintes funções foram convertidas em **módulos locais** do `sdr-ia-interpret`:
- `sdr-message-parser` → `sdr-ia-interpret/message-parser.ts`
- `sdr-intent-classifier` → `sdr-ia-interpret/intent-classifier.ts`
- `sdr-response-generator` → `sdr-ia-interpret/response-generator.ts`
- `sdr-action-executor` → `sdr-ia-interpret/action-executor.ts`

### Funções consolidadas

| Função antiga | Consolidada em | Action |
|:--|:--|:--|
| `cs-suggest-note` | `cs-ai-actions` | `suggest-note` |
| `cs-churn-predictor` | `cs-ai-actions` | `churn-predict` |
| `cs-incident-detector` | `cs-ai-actions` | `detect-incidents` |
| `cs-daily-briefing` | `cs-scheduled-jobs` | `daily-briefing` |
| `cs-nps-auto` | `cs-scheduled-jobs` | `nps-auto` |
| `cs-renewal-alerts` | `cs-scheduled-jobs` | `renewal-alerts` |
| `cs-trending-topics` | `cs-scheduled-jobs` | `trending-topics` |

### Módulos compartilhados (`_shared/`)

| Módulo | Descrição |
|:--|:--|
| `ai-provider.ts` | Abstração de provedores de IA (OpenAI/Gemini) com telemetria |
| `business-hours.ts` | Cálculo de horário comercial com timezone |
| `config.ts` | Configurações globais e variáveis de ambiente |
| `cors.ts` | Headers CORS (frontend e webhook) |
| `logger.ts` | Logger estruturado JSON |
| `phone-utils.ts` | Normalização de telefone (E.164) |
| `pipeline-routing.ts` | Roteamento de pipeline e deduplicação |
| `tenant.ts` | Validação multi-tenant |
| `types.ts` | Tipos compartilhados |
| `webhook-rate-limit.ts` | Rate limiting para webhooks |
