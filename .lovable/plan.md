
# Bloco 4.1 — Multi-tenancy com Schema Views + RLS Hardening

## Status: ✅ CONCLUÍDO

## O que foi implementado

### Fase 1: Schemas + Views auto-filtradas ✅
- Schemas `blue` e `tokeniza` criados
- **57 views por schema** com `SECURITY INVOKER`, cobrindo:
  - Tabelas com coluna `empresa` direta (~49 tabelas): `contacts`, `organizations`, `pipelines`, `cadences`, `calls`, `cs_customers`, etc.
  - Tabelas sem `empresa` via JOIN (~8 tabelas): `deals` (via pipelines), `deal_activities`, `deal_stage_history`, `deal_cadence_runs`, `pipeline_stages`, `cadence_steps`, `cadence_stage_triggers`, `lead_cadence_events`
- Todas as views são `SECURITY INVOKER` = respeitam RLS do usuário

### Fase 2: RLS Hardening ✅
- **4 views SECURITY DEFINER → SECURITY INVOKER**: `analytics_evolucao_mensal`, `analytics_funil_visual`, `analytics_ltv_cohort`, `seller_leaderboard`
- **5 policies permissivas corrigidas** (role `{public}` → `service_role`):
  - `ai_rate_limits`: ALL {public} → ALL service_role
  - `notifications`: INSERT {public} → INSERT service_role
  - `sgt_event_logs`: INSERT {public} → INSERT service_role
  - `sgt_events`: INSERT/UPDATE {public} → INSERT/UPDATE service_role
- **1 tabela sem policies corrigida**: `webhook_rate_limits` (policy service_role adicionada)

### Fase 3: Função de provisionamento automático ✅
- `provision_tenant_schema(empresa TEXT)` criada
- Para adicionar nova empresa: `SELECT provision_tenant_schema('ACME')`
- Gera automaticamente todas as views + grants

### Fase 4: Zero impacto no frontend ✅
- Frontend continua usando `public` via Supabase JS
- Edge Functions podem optar por usar `blue.contacts` em vez de `public.contacts`

## Warnings residuais (pré-existentes, não criados por esta migração)
- Extension `pg_trgm` em schema public (inofensivo)
- Policies `USING(true)` para `service_role` (esperado)
- Leaked password protection disabled (config de auth)
