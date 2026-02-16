# Plano: Isolamento Multi-Tenant 100%

## Status de Implementação

| Etapa | Descrição | Status |
|-------|-----------|--------|
| 1A | Migração SQL - Batch 1 (tabelas críticas) | ✅ CONCLUÍDO |
| 3A | Remover ALL do CompanyContext + Switcher | ✅ CONCLUÍDO |
| 3B | Limpar hooks (remover !== ALL) | ✅ CONCLUÍDO |
| 1B | Migração SQL - Batch 2 (suporte) | ⬜ PENDENTE |
| 1C | Migração SQL - Batch 3 (config/logs) | ⬜ PENDENTE |
| 2A | Criar _shared/tenant.ts | ⬜ PENDENTE |
| 2B | Refatorar 5 edge functions prioritárias | ⬜ PENDENTE |
| 2C | Refatorar 5 edge functions restantes | ⬜ PENDENTE |
| 3C | Adicionar filtro nos hooks sem empresa | ⬜ PENDENTE |
| 4 | Triggers de validação | ⬜ PENDENTE |
| 5 | Testes de isolamento | ⬜ PENDENTE |

## Detalhes das Etapas Concluídas

### Etapa 1A — RLS Batch 1 (tabelas críticas)
Policies ADMIN hardened com filtro de empresa em 12 tabelas:
- contacts, organizations, pipelines, pipeline_stages, deals
- lead_contacts, lead_messages, lead_message_intents
- lead_classifications, lead_conversation_state
- lead_cadence_runs, lead_contact_issues

Policies SELECT também corrigidas — antes ADMIN via bypass sem empresa.

### Etapa 3A — Remover ALL do CompanyContext
- `ActiveCompany` agora é `'BLUE' | 'TOKENIZA'` (sem `'ALL'`)
- CompanySwitcher não mostra mais opção "Todas"
- localStorage com valor 'ALL' faz fallback para 'BLUE'

### Etapa 3B — Limpar hooks
~40 arquivos corrigidos removendo padrões `!== 'ALL'` e `=== 'ALL' ? X : Y`.
Hooks agora sempre aplicam filtro de empresa obrigatoriamente.

## Próximos Passos

### Etapa 1B — Batch 2 (suporte)
Tabelas: cadences, cadence_steps, message_templates, custom_field_definitions, custom_field_values, product_knowledge, sgt_events, metas_vendedor, comissao_lancamentos, comissao_regras, follow_up_optimal_hours, integration_company_config, mass_action_jobs, sazonalidade_indices, notifications, cs_customers, cs_incidents, cs_surveys, cs_playbooks

### Etapa 1C — Batch 3 (config/logs)
Tabelas globais/logs: access_profiles, ai_model_benchmarks, ai_usage_log, analytics_events, cadence_runner_logs, prompt_versions, system_settings, rate_limit_log

### Etapa 2A-2C — Edge Functions
Criar `_shared/tenant.ts` e refatorar 10 edge functions com queries cross-tenant.

### Etapa 3C — Hooks sem filtro empresa
Auditar e corrigir: useAIMetrics, useAutoRules, useObservabilityData, useLeadClassification, useOperationalHealth, useSdrIaStats

### Etapa 4 — Triggers de validação
Cross-tenant validation em deals, lead_cadence_runs, custom_field_values, cs_customers.

### Etapa 5 — Testes de isolamento
Testes automatizados de isolamento entre tenants.
