---
sidebar_position: 10
title: ADRs
---

# Architecture Decision Records

Os ADRs documentam decisões arquiteturais significativas do projeto.

## ADR-001: Refatoração useCadences

**Decisão**: Decompor o hook monolítico `useCadences` em módulos especializados (`useCadences`, `useCadenceMutations`, `useCadenceRuns`, `useCadenceEvents`).

**Motivação**: Reduzir complexidade, facilitar testes e manutenção.

## ADR-002: Adoção do Sentry

**Decisão**: Adotar Sentry como plataforma de observabilidade para error tracking e performance monitoring.

**Motivação**: Visibilidade de erros em produção e métricas de performance.

## ADR-003: ESLint + Prettier

**Decisão**: Adotar ESLint e Prettier como ferramentas de lint e formatação.

**Motivação**: Consistência de código e prevenção de bugs comuns.

## ADR-004: Testes E2E com Playwright

**Decisão**: Adotar Playwright para testes end-to-end com Page Object pattern.

**Motivação**: Cobertura de fluxos críticos (auth, pipeline, contatos, cadências) com testes automatizados.

---

:::info Referência Completa
Os ADRs completos estão disponíveis em `docs/adr/` no repositório do projeto.
:::
