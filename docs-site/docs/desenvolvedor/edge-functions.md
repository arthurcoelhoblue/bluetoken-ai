---
sidebar_position: 2
title: Edge Functions
---

# Edge Functions

As Edge Functions são funções serverless em **Deno** que executam lógica de backend, especialmente tarefas de IA.

## Padrão de Decomposição

Edge Functions complexas são decompostas em módulos especializados:

```
supabase/functions/nome-da-funcao/
  index.ts          # Orquestrador principal
  types.ts          # Tipos e interfaces
  auth.ts           # Autenticação e autorização
  validation.ts     # Validação de entrada
  ...outros módulos específicos
```

O `index.ts` serve apenas como orquestrador do fluxo, reduzindo complexidade ciclomática.

## Módulos Compartilhados

```
supabase/functions/_shared/
  ai-provider.ts       # Abstração de provedores de IA
  business-hours.ts    # Cálculo de horário comercial
  config.ts            # Configurações globais
  cors.ts              # Headers CORS
  logger.ts            # Logger estruturado
  phone-utils.ts       # Utilitários de telefone (E.164)
  pipeline-routing.ts  # Roteamento de pipeline
  types.ts             # Tipos compartilhados
  webhook-rate-limit.ts # Rate limiting para webhooks
```

## Exemplos de Edge Functions

| Função | Descrição |
|:--|:--|
| `sdr-ia-interpret` | Orquestrador SDR (parser + classifier + generator + executor internalizados) |
| `cadence-runner` | Processa passos de cadências ativas |
| `deal-scoring` | Calcula score de probabilidade |
| `cs-health-calculator` | Calcula Health Score dos clientes |
| `cs-ai-actions` | Ações CS sob demanda (suggest-note, churn-predict, detect-incidents) |
| `cs-scheduled-jobs` | Jobs CS agendados (daily-briefing, nps-auto, renewal-alerts, trending-topics) |
| `cs-playbook-runner` | Executa playbooks automatizados de CS |
| `bluechat-inbound` | Recebe mensagens do BlueChat |
| `sgt-webhook` | Webhook do SGT (tráfego) |
| `copilot-chat` | Chat com Amélia Copilot (streaming) |

## CORS

Todas as Edge Functions usam o módulo compartilhado de CORS:

```typescript
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  // ... lógica
});
```
