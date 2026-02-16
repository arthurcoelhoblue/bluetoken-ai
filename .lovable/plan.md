
# Ciclo H — Rumo ao 11/10

## Ordem de Execução

| Fase | Objetivo | Dependências |
|------|----------|-------------|
| **H3** | Zod validation em webhooks inbound | Nenhuma |
| **H4** | Performance (lazy loading, bundle splitting, Web Vitals) | Nenhuma |
| **H1** | Sentry error tracking em produção | Secret SENTRY_DSN |
| **H2** | Testes E2E (Playwright) | Playwright setup |

---

## H3 — Zod Validation em Webhooks Inbound

### Escopo
Adicionar validação rigorosa com Zod nos 3 webhooks inbound:
1. `bluechat-inbound` — já tem `schemas.ts`, reforçar com Zod
2. `whatsapp-inbound` — payload sem validação formal
3. `sgt-webhook` — já tem `validation.ts`, migrar para Zod

### Implementação
- Criar schemas Zod em cada função (ou `_shared/schemas/`)
- Parse no início do handler com `.safeParse()`
- Retornar 400 com detalhes do erro em caso de falha
- Manter `.passthrough()` em objetos de metadados para flexibilidade

---

## H4 — Performance Monitoring

### Escopo
- React.lazy + Suspense para code-splitting de rotas
- Lazy loading de componentes pesados (Recharts, editors)
- Monitoramento de Web Vitals (LCP, CLS, INP)
- Bundle analysis e otimização

---

## H1 — Sentry Error Tracking

### Escopo
- Integrar Sentry SDK no frontend
- Captura automática de erros não tratados
- Source maps para stack traces legíveis
- Breadcrumbs para contexto de navegação
- Requer: secret SENTRY_DSN

---

## H2 — Testes E2E

### Escopo
- Setup Playwright com fluxos críticos:
  - Login/Auth
  - Pipeline (criar deal, mover entre estágios)
  - Cadências (criar, executar)
  - Contatos (CRUD)
- CI-ready configuration
