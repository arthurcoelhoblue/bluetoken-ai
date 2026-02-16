# Plano: Isolamento Multi-Tenant 100%

## Resumo Executivo

O sistema tem isolamento de aproximadamente 80%. O plano do documento esta correto nos diagnosticos, mas precisa ser adaptado a realidade do codigo atual. A analise linha a linha revelou:

- **54 tabelas** com policies de ADMIN sem filtro de empresa (a causa raiz)
- **6+ Edge Functions** que fazem queries cross-tenant com service_role
- **13 hooks** no frontend que usam o padrao `!== 'ALL'` (permitindo ver tudo)
- A opcao "ALL" no CompanySwitcher e um anti-pattern que precisa ser removido

## Fase 1: Hardening do Banco de Dados (RLS)

**Prioridade: CRITICA | Risco: BAIXO (additive)**

Criar funcao helper `get_user_empresa` caso nao exista, e substituir todas as 54 policies de ADMIN que nao filtram por empresa.

### Tabelas afetadas (54 com admin policies sem filtro de empresa)

Tabelas com coluna `empresa` direta (correcao simples):

- cadences, cadence_steps (via cadences join), contacts, custom_field_definitions, custom_field_values (via entity join), lead_contacts, lead_messages, lead_message_intents, lead_classifications, lead_conversation_state, lead_cadence_runs, lead_contact_issues, message_templates, organizations, pipelines, pipeline_stages (via pipeline join), pipeline_auto_rules, product_knowledge, sgt_events, metas_vendedor, comissao_lancamentos, comissao_regras, follow_up_optimal_hours, integration_company_config, mass_action_jobs, sazonalidade_indices, zadarma_config, zadarma_extensions, user_access_assignments, notifications

Tabelas SEM coluna `empresa` (requer join ou sao globais):

- deals (filtrar via pipeline_empresa ou contacts.empresa)
- deal_cadence_runs (via deals join)
- deal_loss_categories (global/config, pode manter admin-only)
- profiles (filtrar via get_user_empresa)
- user_roles (filtrar via get_user_empresa)
- access_profiles (sao definicoes globais, manter)
- ai_model_benchmarks, ai_usage_log (telemetria, admin-only ok)

analytics_events (telemetria)

- call_events (via calls join)
- cadence_runner_logs (logs internos)
- cadence_stage_triggers (config global)
- conversation_takeover_log (via lead join)
- import_jobs, import_mapping (tem empresa)
- knowledge_documents, knowledge_faq, knowledge_sections
- pessoas (via contact join)
- prompt_versions (config global)
- rate_limit_log (sistema)
- revenue_forecast_log (tem empresa)
- sgt_event_logs (logs)
- system_settings (config global)

### Estrategia de migracao SQL

```text
-- Padrao para tabelas com coluna empresa:
DROP POLICY IF EXISTS "Admins can manage X" ON public.X;
CREATE POLICY "Admins can manage X in own empresa" ON public.X
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN') 
    AND empresa = get_user_empresa(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'ADMIN')
    AND empresa = get_user_empresa(auth.uid())
  );

-- Padrao para tabelas sem coluna empresa (ex: deals via pipeline):
CREATE POLICY "Admins can manage deals in own empresa" ON public.deals
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN')
    AND pipeline_empresa = get_user_empresa(auth.uid())
  );

-- Tabelas globais (config, logs): manter admin-only sem filtro empresa
-- access_profiles, prompt_versions, system_settings, ai_usage_log
```

A migracao sera dividida em 3 batches para reducao de risco:

1. Batch 1: Tabelas criticas de dados (contacts, leads, deals, pipelines)
2. Batch 2: Tabelas de suporte (cadences, templates, CS)
3. Batch 3: Tabelas de config/logs (analytics, system_settings)

## Fase 2: Criar `createTenantClient` para Edge Functions

**Prioridade: CRITICA | Risco: MEDIO**

### Arquivo novo: `supabase/functions/_shared/tenant.ts`

Criar um wrapper que force isolamento em toda query no backend:

```text
createTenantClient(empresa: string)
  .tenantFrom('tabela')     -> auto-adiciona .eq('empresa', empresa)
  .tenantFromJoin('deals')  -> para tabelas sem coluna empresa
  .rawFrom('tabela')        -> bypass explicito (para system_settings, etc)
  .assertEmpresa(empresa)   -> valida que empresa foi passada
```

### Edge Functions a refatorar (queries cross-tenant confirmadas)


| Funcao                | Problema                                  | Correcao                                                       |
| --------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| `deal-scoring`        | Busca deals sem filtro empresa            | Adicionar join com pipeline_empresa ou receber empresa no body |
| `icp-learner`         | Busca won/lost deals de TODAS empresas    | Receber empresa, filtrar por contacts.empresa                  |
| `ai-benchmark`        | Busca intents sem filtro empresa          | Filtrar por empresa na query                                   |
| `deal-loss-analysis`  | Portfolio mode sem filtro em wons/losts   | Filtrar por contacts.empresa                                   |
| `cs-trending-topics`  | Busca surveys sem filtro empresa          | Ja tem empresa nos dados mas nao filtra query                  |
| `cs-renewal-alerts`   | Notifica sem validar empresa do csm       | Validar csm pertence a mesma empresa                           |
| `follow-up-scheduler` | Busca mensagens de todas empresas         | Filtrar por empresa do request                                 |
| `next-best-action`    | Busca SLA/tarefas sem filtro empresa      | Recebe empresa, aplicar em todas queries                       |
| `revenue-forecast`    | Won/lost deals sem filtro empresa         | Filtrar por pipeline_empresa                                   |
| `copilot-chat`        | Enrichment functions parcialmente filtram | Auditar cada enrich function                                   |


### Edge Functions que JA filtram corretamente

- `bluechat-inbound`, `whatsapp-inbound`, `sdr-*` (modular SDR), `cadence-runner`, `amelia-learn`, `weekly-report`

## Fase 3: Refatoracao do Frontend

**Prioridade: ALTA | Risco: BAIXO**

### 3.1 Remover opcao "ALL" do CompanyContext

Alterar `CompanyContext.tsx`:

- Remover `'ALL'` do tipo `ActiveCompany` -> `type ActiveCompany = 'BLUE' | 'TOKENIZA'`
- Remover entrada "ALL/Todas" do `LABELS`
- Fallback de localStorage: se stored === 'ALL', default para a empresa do usuario (via profile)

Alterar `CompanySwitcher.tsx`:

- Remover opcao "Todas" do array `options`

### 3.2 Remover padrao `!== 'ALL'` dos hooks

Os 13 hooks que usam `if (activeCompany !== 'ALL')` passarao a sempre aplicar o filtro, pois `activeCompany` nunca sera 'ALL':

- useContacts, useContactsPage, useOrganizations, useOrganizationsPage
- useCustomFields, usePipelines, useTemplates, useCSMetrics
- useCSSurveys, useCSRevenueForecast, useCSIncidents
- useAmeliaLearnings, useCadenciasCRM

Os 8 hooks que usam `empresaFilter()` (retorna null para ALL) terao a funcao simplificada para sempre retornar a empresa.

### 3.3 Hooks sem filtro empresa (auditoria)

Hooks que fazem queries sem filtro empresa e precisam ser corrigidos:

- `useAIMetrics` - busca lead_message_intents sem empresa
- `useAutoRules` - busca pipeline_auto_rules sem empresa  
- `useObservabilityData` - precisa verificar
- `useLeadClassification` - precisa verificar
- `useOperationalHealth` - precisa verificar
- `useSdrIaStats` - precisa verificar

## Fase 4: Triggers de Validacao Cross-Tenant

**Prioridade: MEDIA | Risco: BAIXO**

Criar triggers que impedem insercoes com inconsistencia de tenant:

```text
-- Trigger em deals: validar que contact_id pertence a mesma empresa do pipeline
-- Trigger em deal_activities: validar que deal pertence a empresa do usuario
-- Trigger em lead_cadence_runs: validar cadence.empresa == lead.empresa
```

Tabelas-alvo para triggers de validacao:

1. `deals` - contact_id vs pipeline.empresa
2. `lead_cadence_runs` - cadence.empresa vs lead_contacts.empresa
3. `custom_field_values` - entity empresa vs field.empresa
4. `cs_customers` - contact.empresa vs cs_customer.empresa

## Fase 5: Testes de Isolamento

**Prioridade: ALTA | Risco: NENHUM**

Criar testes em `supabase/functions/_shared/tenant_test.ts`:

- Teste que usuario BLUE nao ve dados TOKENIZA
- Teste que admin BLUE nao pode modificar dados TOKENIZA
- Teste que Edge Functions rejeitam requests sem empresa

## Sequencia de Implementacao

Devido ao tamanho, o trabalho sera dividido em etapas sequenciais:


| Etapa | Descricao                                 | Arquivos       |
| ----- | ----------------------------------------- | -------------- |
| 1A    | Migracao SQL - Batch 1 (tabelas criticas) | SQL migration  |
| 1B    | Migracao SQL - Batch 2 (suporte)          | SQL migration  |
| 1C    | Migracao SQL - Batch 3 (config/logs)      | SQL migration  |
| 2A    | Criar _shared/tenant.ts                   | 1 arquivo novo |
| 2B    | Refatorar 5 edge functions prioritarias   | 5 arquivos     |
| 2C    | Refatorar 5 edge functions restantes      | 5 arquivos     |
| 3A    | Remover ALL do CompanyContext + Switcher  | 2 arquivos     |
| 3B    | Limpar hooks (remover !== ALL)            | ~15 arquivos   |
| 3C    | Adicionar filtro nos hooks sem empresa    | ~6 arquivos    |
| 4     | Triggers de validacao                     | SQL migration  |
| 5     | Testes de isolamento                      | 1 arquivo novo |


## Riscos e Mitigacoes

- **Risco**: Admin que gerencia ambas empresas perde visao consolidada
  - **Mitigacao**: O tipo do usuario tera empresa associada; para superadmins, criar role SUPERADMIN separado no futuro
- **Risco**: Dados historicos sem empresa preenchida
  - **Mitigacao**: Antes de ativar RLS, rodar script que preenche empresa em registros orfaos
- **Risco**: Edge functions quebrarem por falta de empresa no request
  - **Mitigacao**: assertEmpresa() retorna erro 400 claro, logs facilitam debug