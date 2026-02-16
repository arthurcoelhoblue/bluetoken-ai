
# Ciclo H — Rumo ao 11/10

## Status Final

| Fase | Objetivo | Status |
|------|----------|--------|
| **H3** | Zod validation em webhooks inbound | ✅ Já existia |
| **H4a** | Code splitting (React.lazy) | ✅ Já existia |
| **H4b** | Web Vitals monitoring (LCP, CLS, INP, FCP, TTFB) | ✅ Implementado |
| **H1** | Sentry error tracking | ✅ Implementado |
| **H2** | Testes E2E (Playwright) | ⏸️ Requer infraestrutura CLI |

## Implementações do Ciclo H

### H4b — Web Vitals
- `src/lib/web-vitals.ts` — reporta métricas degradadas para `analytics_events`
- Métricas: LCP, CLS, INP, FCP, TTFB
- Filtro inteligente: só reporta `needs-improvement` e `poor`

### H1 — Sentry
- `src/lib/sentry.ts` — SDK com tracing, replay, PII redaction
- `ErrorBoundary.tsx` — integrado com `Sentry.captureException()`
- Configuração: 10% traces, 50% error replays
- Secret: `VITE_SENTRY_DSN`

### Validação
- 314/314 testes passando (0 regressões)
