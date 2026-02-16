

# Plano de Remediação Multi-Tenancy — Status

## Fase 1 — RLS ✅ CONCLUÍDA
- `deal_stage_history`: Policy corrigida com filtro via `deals -> pipelines -> empresa`
- `seller_badges`: Tabela global de definições, sem necessidade de filtro

## Fase 2 — Frontend Hooks ✅ CONCLUÍDA
- `useNotifications`: Filtro `.eq('empresa', activeCompany)` adicionado
- `useAICostDashboard`: Filtro `.eq('empresa', activeCompany)` adicionado
- `useAdoptionMetrics`: Filtro `.eq('empresa', activeCompany)` adicionado
- `useLossPendencies`: Filtro via join `pipelines:pipeline_id!inner(empresa)` adicionado
- `useOrphanDeals`: Filtro via join `pipelines:pipeline_id!inner(empresa)` adicionado
- `useSystemSettings`: Tabela global por design (sem coluna empresa)
- `usePromptVersions`: Tabela global por design (sem coluna empresa)

## Fase 3 — Edge Functions ✅ CONCLUÍDA

### Grupo A — Funções chamadas pelo frontend (6 funções)
| Função | Status | Correção |
|--------|--------|----------|
| `next-best-action` | ✅ | `assertEmpresa` + filtros `pipeline_empresa`/`empresa` em todas 8 queries |
| `amelia-mass-action` | ✅ | `assertEmpresa(job.empresa)` + filtro `pipeline_empresa` em queries de deals |
| `deal-context-summary` | ✅ | `assertEmpresa(contact.empresa)` + filtros em messages/classifications/intents |
| `call-coach` | ✅ | Resolve `pipeline_empresa` do deal + filtra `knowledge_products` por empresa |
| `amelia-learn` | ✅ | Filtro `pipeline_empresa` em 3 queries: perdas, inativos, lostDeals |
| `cs-suggest-note` | ✅ | `assertEmpresa(customer.empresa)` para validar tenant |

### Grupo B — CRON jobs (3 funções)
| Função | Status | Correção |
|--------|--------|----------|
| `cs-daily-briefing` | ✅ | Query `cs_incidents` filtrada por `empresa` + `customer_id` |
| `revenue-forecast` | ✅ | `wonDeals` e `lostDeals` filtrados por `pipeline_empresa` quando `targetEmpresa` fornecido |
| `cs-trending-topics` | ✅ | Refatorado para iterar por empresa, salva resultados em chaves separadas (`cs.trending_topics.BLUE`, `cs.trending_topics.TOKENIZA`) |

### Nota sobre `knowledge_products`
A tabela `knowledge_products` não existe no schema atual. A query em `call-coach` retornará vazio silenciosamente. Quando a tabela for criada, o filtro `.eq('empresa', resolvedEmpresa)` já está implementado.

## Fase 4 — Triggers de Validação 🔲 PENDENTE
## Fase 5 — Testes de Isolamento 🔲 PENDENTE
## Fase 6 — Documentação e ADR 🔲 PENDENTE
