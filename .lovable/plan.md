
# Roadmap V7 → 11/10 — Blocos por Prioridade

## BLOCO 1 — Quick Wins ✅

### 1.1 Versionar 16 CRON jobs ✅
- Documentação criada em `docs/patches/PATCH-CRON-VERSIONING.md`
- 16 jobs mapeados com SQL idempotente pronto para execução

### 1.2 Reduzir `as any` restantes ✅
- Reduzido de 51 para 12 ocorrências (76% de redução)
- 314/314 testes passando

---

## BLOCO 2 — Observabilidade Avançada ✅

### 2.1 Dashboard de saúde operacional melhorado ✅
- Web Vitals (LCP/CLS/INP/FCP/TTFB) integrados na página existente
- Latência de Edge Functions com dados do `ai_usage_log`
- Componentes: `WebVitalsCard`, `EdgeFunctionLatencyCard`
- Hook: `useObservabilityData`

### 2.2 Sentry para Edge Functions ✅
- Logger compartilhado (`_shared/logger.ts`) agora envia erros para Sentry via HTTP envelope API
- Método `captureException()` disponível para stack traces completos
- Auto-report em todas as chamadas `log.error()`
- Secret `SENTRY_DSN_EDGE` configurado
- Zero dependências externas (usa fetch nativo do Deno)

---

## BLOCO 3 — Automação Inteligente (próximo)

### 3.1 Atividade auto-criada após transcrição de chamada
- Status: PENDENTE

---

## BLOCO 4 — Arquitetura de Longo Prazo (1-3 meses)

### 4.1 Multi-tenancy com schema separation
- Status: PENDENTE

### 4.2 Revenue forecast com ML
- Status: PENDENTE
