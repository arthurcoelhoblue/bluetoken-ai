---
sidebar_position: 9
title: Testes
---

# Estratégia de Testes

## Stack de Testes

| Ferramenta | Uso |
|:--|:--|
| **Vitest** | Testes unitários e de integração (frontend) |
| **Testing Library** | Testes de componentes React |
| **Playwright** | Testes E2E (end-to-end) |
| **Deno Test** | Testes de Edge Functions |

## Estrutura

```
src/
  test/
    setup.ts              # Setup global do Vitest
    fixtures/             # Dados de teste
    helpers/              # Mocks (supabase-mock.ts)
    hooks/                # Testes de hooks
    integration/          # Testes de integração
  hooks/__tests__/        # Testes unitários de hooks
  lib/__tests__/          # Testes de lógica de negócio
  schemas/__tests__/      # Testes de validação

e2e/
  pages/                  # Page Objects (auth, pipeline, etc.)
  *.spec.ts              # Specs E2E
```

## Convenções

- Testes unitários: `*.test.ts` próximo ao arquivo testado
- Testes E2E: `e2e/*.spec.ts` com Page Objects em `e2e/pages/`
- Fixtures reutilizáveis em `src/test/fixtures/`
- Mock do Supabase em `src/test/helpers/supabase-mock.ts`
