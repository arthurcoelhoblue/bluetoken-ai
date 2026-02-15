
# Plano de Melhoria Técnica - CRM SDR

## Status Geral

### Fase 1 - Segurança
- [x] 1.1 - Validação de input nos webhooks (Zod schemas)
- [x] 1.2 - Rate limiting nos webhooks públicos (webhook_rate_limits table + _shared/webhook-rate-limit.ts)

### Fase 2 - Refatoração
- [x] 2.1 - Extrair tipos compartilhados (_shared/types.ts)
- [x] 2.2 - Extrair utilitários compartilhados (_shared/phone-utils.ts, business-hours.ts, pipeline-routing.ts)
- [x] 2.3 - Refatorar edge functions grandes (sgt-webhook, bluechat-inbound, cadence-runner)

### Fase 3 - Performance
- [x] 3.1 - Views materializadas (já existentes: deals_full_detail, analytics_*, etc.)
- [x] 3.2 - Índices otimizados (já existentes nos campos de busca principais)
- [N/A] 3.3 - Otimização N+1 (hooks já usam queries paralelas, views e joins inline)

---

## Detalhes de Implementação

### 1.2 - Rate Limiting
- Tabela `webhook_rate_limits` com RLS (sem policies = somente service_role)
- Módulo `_shared/webhook-rate-limit.ts` com checkWebhookRateLimit + rateLimitResponse
- Limites: sgt-webhook 120/min, whatsapp-inbound 200/min, bluechat-inbound 150/min
- Estratégia fail-open (se DB falhar, permite a requisição)

### 2.3 - Módulos Compartilhados
- `_shared/types.ts` - EmpresaTipo, Temperatura, TipoLead, CanalTipo, LeadContact, LeadCadenceRun
- `_shared/phone-utils.ts` - normalizePhoneE164, generatePhoneVariationsForSearch, isPlaceholderEmailForDedup
- `_shared/business-hours.ts` - getHorarioBrasilia, isHorarioComercial, proximoHorarioComercial
- `_shared/pipeline-routing.ts` - resolveTargetPipeline, findExistingDealForPerson, PIPELINE_MAP
