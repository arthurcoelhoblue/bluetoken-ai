---
sidebar_position: 1
title: Stack Tecnológica
---

# Stack Tecnológica

## Frontend

| Tecnologia | Versão | Uso |
|:--|:--|:--|
| **React** | 18.x | Framework UI |
| **Vite** | 5.x | Build tool e dev server |
| **TypeScript** | 5.x | Tipagem estática |
| **Tailwind CSS** | 3.x | Estilização utility-first |
| **shadcn/ui** | - | Componentes base (Radix UI) |
| **TanStack Query** | 5.x | Gerenciamento de estado servidor |
| **React Router** | 6.x | Roteamento SPA |
| **Recharts** | 2.x | Gráficos e visualizações |
| **Zod** | 3.x | Validação de schemas |

## Backend

| Tecnologia | Uso |
|:--|:--|
| **Supabase** | BaaS (PostgreSQL + Auth + Storage + Realtime) |
| **Edge Functions (Deno)** | Lógica serverless (IA, webhooks, automação) |
| **PostgreSQL** | Banco de dados relacional com RLS |

## Observabilidade

| Tecnologia | Uso |
|:--|:--|
| **Sentry** | Error tracking e performance monitoring |
| **Web Vitals** | Métricas de performance do frontend |

## Estrutura de Pastas

```
src/
  components/     # Componentes React organizados por domínio
  pages/          # Páginas/rotas da aplicação
  hooks/          # Custom hooks (queries, mutations, lógica)
  types/          # Tipos TypeScript
  schemas/        # Schemas Zod de validação
  lib/            # Utilitários e lógica de negócio
  contexts/       # React Contexts (Auth, Company, Theme)
  config/         # Configurações (screen registry, etc.)
  integrations/   # Clients de integração (Supabase)

supabase/
  functions/      # Edge Functions (Deno)
  migrations/     # Migrações SQL
```
