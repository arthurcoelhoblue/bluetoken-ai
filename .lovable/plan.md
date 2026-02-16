
# Plano de Segurança Multi-Tenant

## Status das Etapas

### ✅ Fase 1A — RLS Hardening Batch 1 (tabelas críticas)
Completo. Políticas endurecidas para deals, contacts, organizations, deal_activities, custom_field_values, pessoas, profiles.

### ✅ Fase 1B — RLS Hardening Batch 2 (comunicação + CS)
Completo. Políticas endurecidas para lead_messages, lead_contacts, lead_cadence_runs, notifications, cs_customers, cs_incidents.

### ✅ Fase 1C — RLS Hardening Batch 3 (config + logs)
Completo. Políticas endurecidas para analytics_events, ai_usage_log, rate_limit_log, revenue_forecast_log. Limpeza de políticas duplicadas.

### ✅ Fase 2A — Criar `_shared/tenant.ts`
Completo. Helper module criado com:
- `assertEmpresa(empresa)` — valida tenant ('BLUE' | 'TOKENIZA')
- `extractEmpresa(body, supabase, authHeader)` — extrai empresa do body ou JWT

### ✅ Fase 2B — Refatorar 5 Edge Functions Prioritárias
Completo. Funções refatoradas:

1. **`icp-learner`**: empresa obrigatório, filtra deals via `contacts!inner(empresa)`, salva resultado com key `icp_profile_{empresa}`
2. **`deal-scoring`**: empresa opcional no batch mode, filtra deals via pipeline IDs da empresa
3. **`deal-loss-analysis`**: empresa obrigatório no modo portfolio, filtra via `contacts!inner(empresa)`, salva com key `win_loss_analysis_{empresa}`
4. **`follow-up-scheduler`**: empresa obrigatório, filtra `lead_messages` por empresa
5. **`copilot-proactive`**: assertEmpresa adicionado, deals filtrados por pipeline IDs da empresa

### 🔲 Fase 3 — Triggers cross-tenant
Avaliar triggers que podem vazar dados entre tenants (ex: `fn_gamify_deal_ganho`, `calc_comissao_deal`).

### 🔲 Fase 4 — Testes de isolamento
Criar testes automatizados para validar que queries cross-tenant retornam vazio.

## Funções CRON (não refatoradas)
`cs-churn-predictor`, `cs-health-calculator`, `cs-incident-detector`, `cs-renewal-alerts`, `cadence-runner`, `weekly-report` são funções CRON que intencionalmente operam em todos os tenants e já isolam dados por `customer_id` ou `empresa` internamente.
