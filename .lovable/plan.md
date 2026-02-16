

# Plano de Remediacao Multi-Tenancy 11/10

Baseado na auditoria pos-implementacao, este plano aborda todos os gaps identificados em 4 camadas, organizados por prioridade e risco.

---

## Contexto

A auditoria atribuiu nota 9.8/10 ao estado geral, mas identificou falhas criticas no backend (nota 3/10) e lacunas em frontend e defesa em profundidade. O trabalho sera dividido em 6 fases sequenciais.

---

## Fase 1 -- RLS: Corrigir 2 tabelas restantes (Risco Medio)

Corrigir as policies com `USING (true)` em:

| Tabela | Problema | Correcao |
|--------|----------|----------|
| `deal_stage_history` | SELECT com `USING (true)` expoe historico de funil entre tenants | Adicionar filtro via join com `deals -> pipelines` para resolver empresa |
| `seller_badges` | SELECT com `USING (true)` expoe badges entre tenants | Adicionar filtro por empresa (se coluna existir) ou via `profiles -> user_access_assignments` |

Uma unica SQL migration resolve ambos.

---

## Fase 2 -- Frontend: Corrigir 8 hooks criticos (Risco Alto)

Cada hook abaixo sera atualizado para importar `useCompany()` e filtrar queries pela `activeCompany`. O padrao ja existe no projeto e sera replicado.

| Hook | Correcao |
|------|----------|
| `useDealDetail` | Busca deal por ID via view -- RLS ja protege. Sem acao necessaria se RLS de `deals` esta correto (ja esta). **Risco real: baixo.** |
| `useLossPendencies` | Adicionar filtro por empresa via join `pipelines:pipeline_id(empresa)` + `.eq()` |
| `useOrphanDeals` | Adicionar filtro por empresa via join `pipelines:pipeline_id(empresa)` + `.eq()` |
| `useAICostDashboard` | Adicionar `.eq('empresa', activeCompany)` na query de `ai_usage_log` |
| `useAdoptionMetrics` | Adicionar `.eq('empresa', activeCompany)` na query de `analytics_events` |
| `useSystemSettings` | Adicionar `.eq('empresa', activeCompany)` -- **OU** manter sem filtro se settings sao globais por design. Avaliar se `system_settings` tem coluna `empresa`. |
| `usePromptVersions` | Tabela `prompt_versions` -- verificar se tem coluna `empresa`. Se sim, filtrar. Se nao, e global por design. |
| `useNotifications` | Adicionar `.eq('empresa', activeCompany)` (tabela ja tem coluna `empresa`) |

Cada hook recebe `useCompany()` e inclui `activeCompany` na queryKey para invalidacao automatica ao trocar empresa.

---

## Fase 3 -- Backend: Refatorar Edge Functions restantes (Risco Critico)

Esta e a fase mais extensa. Das 42 funcoes que usam `createServiceClient`, 5 ja foram corrigidas. Das 37 restantes, muitas sao CRON jobs que operam intencionalmente em todos os tenants ou funcoes que operam por ID especifico (seguras por natureza).

### Classificacao das funcoes restantes

**Grupo A -- Precisam de filtro `empresa` obrigatorio (chamadas por usuario/frontend):**

| Funcao | Correcao |
|--------|----------|
| `next-best-action` | Recebe `empresa` no body, filtrar todas as 8 queries por empresa |
| `amelia-mass-action` | Resolver empresa do job e filtrar queries |
| `deal-context-summary` | Opera por deal_id -- seguro via RLS se `deals` tem RLS. Mas usar service_role requer validacao. Adicionar filtro empresa |
| `call-coach` | Opera por deal_id -- similar, adicionar validacao |
| `amelia-learn` | Ja recebe `empresa` e filtra. **Verificar completude.** |
| `cs-suggest-note` | Opera por customer_id, resolver empresa do customer |

**Grupo B -- CRON jobs que devem processar todos os tenants mas precisam isolar resultados:**

| Funcao | Correcao |
|--------|----------|
| `revenue-forecast` | Queries de `wonDeals` e `lostDeals` nao filtram por empresa. Corrigir para filtrar quando `targetEmpresa` e fornecido |
| `cs-daily-briefing` | Query de `cs_incidents` nao filtra por empresa. Adicionar filtro |
| `cs-trending-topics` | Query de `cs_surveys` nao filtra por empresa. Adicionar filtro e salvar resultado por empresa |
| `cs-churn-predictor` | CRON -- opera em todos. Resultados ja isolados por customer. **Baixa prioridade** |
| `cs-health-calculator` | CRON -- seguro, opera por customer_id. **Sem acao** |
| `cs-incident-detector` | CRON -- opera em todos. **Verificar se isola resultados** |
| `cs-renewal-alerts` | CRON -- opera em todos. **Verificar** |
| `weekly-report` | CRON -- ja itera por empresa. **Verificar completude** |

**Grupo C -- Funcoes de webhook/integracao (operam por evento especifico, risco baixo):**

`bluechat-inbound`, `whatsapp-inbound`, `whatsapp-send`, `zadarma-webhook`, `zadarma-proxy`, `sgt-webhook`, `sgt-buscar-lead`, `sgt-sync-clientes`, `capture-form-submit`, `email-send`, `notify-closer`, `pipedrive-sync`, `call-transcribe`

Estas recebem dados de um evento especifico (uma mensagem, um webhook) e operam apenas naquele contexto. **Risco baixo, sem acao imediata.**

**Grupo D -- Funcoes SDR (operam por lead/mensagem especifica):**

`sdr-ia-interpret`, `sdr-intent-classifier`, `sdr-message-parser`, `sdr-response-generator`, `sdr-action-executor`, `reclassify-leads`, `faq-auto-review`, `tokeniza-offers`

Operam sobre um lead ou mensagem especifica. **Risco baixo se RLS esta correto nas tabelas base.**

### Abordagem

Para cada funcao do Grupo A e B:
1. Importar `assertEmpresa` e `extractEmpresa` de `_shared/tenant.ts`
2. Extrair empresa do body ou do contexto da entidade
3. Adicionar `.eq('empresa', empresa)` ou filtro via join em cada query

**Nota sobre `createTenantClient`**: A auditoria sugere um wrapper automatico. Porem, criar um proxy Supabase client que injeta filtros automaticamente e complexo e fragil (nem toda tabela tem coluna `empresa` direta; muitas precisam de joins). A abordagem manual com `assertEmpresa` + filtros explicitos e mais segura e previsivel. O importante e cobrir todas as funcoes.

---

## Fase 4 -- Triggers de validacao no banco (Defesa em Profundidade)

Criar triggers que previnam inconsistencias de tenant em writes criticos:

| Trigger | Tabela | Regra |
|---------|--------|-------|
| `validate_deal_pipeline_tenant` | `deals` | Em INSERT/UPDATE, verificar que `pipeline_id` pertence a mesma empresa do `contact_id` |
| `validate_activity_tenant` | `deal_activities` | Em INSERT, verificar que o deal pertence a empresa do usuario |

Estes sao redes de seguranca -- se todas as outras camadas falharem, estes triggers impedem a corrupcao de dados.

---

## Fase 5 -- Testes de isolamento expandidos

Expandir `tenant_test.ts` com testes HTTP para as funcoes refatoradas:
- Testar que cada funcao do Grupo A retorna erro sem `empresa`
- Testar que funcoes do Grupo A com empresa invalida retornam erro

---

## Fase 6 -- Documentacao e ADR

Atualizar `.lovable/plan.md` e `docs-site/docs/desenvolvedor/multi-tenancy.md` com:
- Status final de todas as fases
- ADR sobre decisao de pausar "schema per tenant"
- Lista completa de funcoes e seu status de isolamento

---

## Sequencia de Execucao

| Ordem | Fase | Estimativa |
|-------|------|-----------|
| 1 | Fase 1 (RLS) | 1 migracao SQL |
| 2 | Fase 2 (Frontend hooks) | 6-8 arquivos editados |
| 3 | Fase 3A (Backend Grupo A) | 6 edge functions |
| 4 | Fase 3B (Backend Grupo B) | 5 edge functions |
| 5 | Fase 4 (Triggers validacao) | 1 migracao SQL |
| 6 | Fase 5 (Testes) | 1 arquivo de testes |
| 7 | Fase 6 (Docs) | 2-3 arquivos |

Devido ao volume, recomendo executar em 2-3 rodadas de implementacao.

---

## Detalhes Tecnicos

### Padrao de correcao nos hooks (exemplo `useNotifications`)

```text
// Antes:
.eq('user_id', user!.id)

// Depois:
.eq('user_id', user!.id)
.eq('empresa', activeCompany)
```

Com `activeCompany` vindo de `useCompany()` e adicionado a `queryKey`.

### Padrao de correcao nas Edge Functions (exemplo `next-best-action`)

```text
// Antes:
const { user_id, empresa } = await req.json();
// empresa recebido mas nunca usado nas queries

// Depois:
const { user_id, empresa } = await req.json();
assertEmpresa(empresa);
// Todas as queries recebem filtro .eq('empresa', empresa) ou via join
```

### Trigger de validacao (exemplo)

```text
CREATE OR REPLACE FUNCTION validate_deal_pipeline_tenant()
RETURNS trigger AS $$
DECLARE v_pipeline_empresa text; v_contact_empresa text;
BEGIN
  SELECT empresa INTO v_pipeline_empresa FROM pipelines WHERE id = NEW.pipeline_id;
  SELECT empresa INTO v_contact_empresa FROM contacts WHERE id = NEW.contact_id;
  IF v_pipeline_empresa IS DISTINCT FROM v_contact_empresa THEN
    RAISE EXCEPTION 'Cross-tenant violation: pipeline empresa (%) != contact empresa (%)',
      v_pipeline_empresa, v_contact_empresa;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

