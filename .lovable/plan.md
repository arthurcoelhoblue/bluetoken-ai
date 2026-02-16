

# Plano: Isolamento Multi-Tenant 100%

## Status

| Etapa | Descricao | Status |
|-------|-----------|--------|
| 1A | RLS Batch 1 — tabelas criticas (contacts, deals, leads, pipelines) | ✅ DONE |
| 1B | RLS Batch 2 — suporte + CS (~24 tabelas) | ✅ DONE |
| 1C | RLS Batch 3 — config/logs | ✅ DONE |
| 2A | Criar _shared/tenant.ts | TODO |
| 2B | Refatorar 5 edge functions prioritarias | TODO |
| 2C | Refatorar 5 edge functions restantes | TODO |
| 3A | Remover ALL do CompanyContext + Switcher | ✅ DONE |
| 3B | Limpar hooks (remover !== ALL) | ✅ DONE |
| 3C | Adicionar filtro nos hooks sem empresa | ✅ DONE |
| 4 | Triggers de validacao cross-tenant | TODO |
| 5 | Testes de isolamento | TODO |

## Detalhes Etapa 1B (concluida)

Migracão aplicada em ~24 tabelas:

**Bloco 1 — Tabelas com empresa direta:**
cadences, message_templates, custom_field_definitions, product_knowledge, metas_vendedor, comissao_lancamentos, comissao_regras, follow_up_optimal_hours, integration_company_config, mass_action_jobs, sgt_events, sazonalidade_indices, import_jobs, import_mapping, zadarma_config, zadarma_extensions, user_access_assignments, knowledge_faq, pipeline_auto_rules

**Bloco 2 — CS (removida brecha OR IS NULL + DELETE true):**
cs_customers, cs_incidents, cs_surveys, cs_playbooks, cs_health_log

**Bloco 3 — Tabelas sem empresa (via JOIN):**
cadence_steps (via cadences), custom_field_values (via custom_field_definitions)

## Detalhes Etapa 3C (concluida)

Hooks corrigidos com filtro empresa:
- useAIMetrics — .eq('empresa', activeCompany)
- useAutoRules — .eq('empresa', activeCompany)
- useSdrIaStats — .eq('empresa', activeCompany) em 3 queries

## Proxima etapa: 1C (RLS Batch 3 — config/logs)

Tabelas restantes: analytics_events, ai_usage_log, ai_model_benchmarks, revenue_forecast_log, rate_limit_log, system_settings, prompt_versions, access_profiles, deal_loss_categories, sgt_event_logs, cadence_runner_logs
