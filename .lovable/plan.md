

# Fase 3 -- Hardening de Edge Functions (Grupos A + B)

Rodada de implementacao cobrindo 9 edge functions com filtros de tenant explicitos.

---

## Grupo A -- Funcoes chamadas pelo frontend (6 funcoes)

### 1. `next-best-action` (RISCO ALTO)
**Problema**: Recebe `empresa` no body mas NENHUMA das 8 queries paralelas filtra por empresa. Dados de deals, SLAs, leads, CS e cadencias de outros tenants podem vazar.

**Correcao**:
- Adicionar `import { assertEmpresa } from "../_shared/tenant.ts"`
- Chamar `assertEmpresa(empresa)` apos extrair do body
- Queries que precisam de filtro:
  - `workbench_tarefas` -- view, verificar se ja filtra. Se nao, adicionar `.eq('empresa', empresa)` (se coluna existir) ou filtrar via pipeline
  - `workbench_sla_alerts` -- view, mesma logica
  - `deals` (2 queries, linhas 41 e 49) -- adicionar join com `pipelines!deals_pipeline_id_fkey(empresa)` + filtro, OU usar coluna `pipeline_empresa` se existir
  - `lead_message_intents` (2 queries, linhas 45 e 57) -- adicionar `.eq('empresa', empresa)`
  - `cs_customers` -- adicionar `.eq('empresa', empresa)`
  - `deal_cadence_runs` -- filtrar via deal -> pipeline

### 2. `amelia-mass-action` (RISCO MEDIO)
**Problema**: Busca job por ID (seguro), mas queries de deals nao filtram por empresa. Um job malicioso poderia operar em deals de outro tenant.

**Correcao**:
- Extrair `empresa` do job (`job.empresa`)
- Chamar `assertEmpresa(job.empresa)` antes de processar
- Na query de deals (linhas 42 e 68), adicionar filtro pela empresa do job via pipeline join

### 3. `deal-context-summary` (RISCO MEDIO)
**Problema**: Busca deal por ID com `service_role` sem validar tenant. Queries subsequentes de messages, intents, classifications nao filtram por empresa.

**Correcao**:
- Extrair empresa do contact do deal (`contact.empresa`)
- Adicionar `.eq('empresa', empresa)` nas queries de `lead_messages`, `lead_conversation_state`, `lead_classifications`, `lead_message_intents`

### 4. `call-coach` (RISCO BAIXO)
**Problema**: Busca deal e contact por ID (seguro por escopo), mas query de `knowledge_products` (linha 39) nao filtra por empresa -- retorna produtos de todos os tenants.

**Correcao**:
- Resolver empresa do deal via pipeline
- Adicionar `.eq('empresa', empresa)` na query de `knowledge_products` (se coluna existir) ou via filtro adequado

### 5. `amelia-learn` (RISCO BAIXO -- ja parcialmente corrigido)
**Problema**: Ja recebe e valida `empresa`, filtra maioria das queries. Porem:
- Linha 38: `deal_activities` query de perdas NAO filtra por empresa
- Linha 69: `deals` query de inativos NAO filtra por empresa
- Linha 100: `deals` query de lostDeals NAO filtra por empresa

**Correcao**:
- Adicionar filtro por empresa nas 3 queries acima (via join com pipelines)

### 6. `cs-suggest-note` (RISCO BAIXO -- ja parcialmente seguro)
**Problema**: Opera por `customer_id`, busca customer com empresa. Queries de surveys, incidents e health_log filtram por `customer_id` (seguro por escopo). Porem, nao valida que o customer pertence ao tenant do chamador.

**Correcao**:
- Adicionar validacao: extrair empresa do customer retornado e passar para `assertEmpresa(customer.empresa)` para garantir que e um tenant valido

---

## Grupo B -- CRON jobs com isolamento incompleto (3 funcoes)

### 7. `cs-daily-briefing` (RISCO MEDIO)
**Problema**: Linha 49 -- query de `cs_incidents` busca TODAS as incidencias abertas sem filtrar por empresa. O filtro posterior (linha 54) mitiga parcialmente filtrando por `customer_id`, mas incidentes de outros tenants sao carregados desnecessariamente.

**Correcao**:
- Resolver empresa dos customers do CSM
- Adicionar `.eq('empresa', empresa)` na query de `cs_incidents` (linha 49)

### 8. `revenue-forecast` (RISCO MEDIO)
**Problema**: 
- Linha 42: `wonDeals` query NAO filtra por `targetEmpresa`
- Linha 43: `lostDeals` query NAO filtra por `targetEmpresa`
- Isso mistura metricas de win rate, tempo medio de fechamento e valor medio entre tenants

**Correcao**:
- Quando `targetEmpresa` e fornecido, filtrar `wonDeals` e `lostDeals` por `pipeline_empresa`
- Na ausencia de `targetEmpresa`, iterar por empresa separadamente (ou manter global como design choice para CRON)

### 9. `cs-trending-topics` (RISCO MEDIO)
**Problema**: Query de `cs_surveys` (linha 17) busca surveys de TODOS os tenants. Resultado e salvo em `system_settings` com chave unica, sobrescrevendo dados de outros tenants.

**Correcao**:
- Agrupar surveys por empresa
- Processar AI separadamente por empresa
- Salvar com chave `cs.trending_topics.BLUE` e `cs.trending_topics.TOKENIZA`

---

## Resumo de mudancas

| Arquivo | Tipo | Mudancas |
|---------|------|----------|
| `supabase/functions/next-best-action/index.ts` | Editar | assertEmpresa + filtros em 8 queries |
| `supabase/functions/amelia-mass-action/index.ts` | Editar | assertEmpresa do job + filtros em queries de deals |
| `supabase/functions/deal-context-summary/index.ts` | Editar | Extrair empresa do contact + filtros em 4 queries |
| `supabase/functions/call-coach/index.ts` | Editar | Resolver empresa do deal + filtro em knowledge_products |
| `supabase/functions/amelia-learn/index.ts` | Editar | Filtros por empresa em 3 queries de deals/activities |
| `supabase/functions/cs-suggest-note/index.ts` | Editar | assertEmpresa no customer retornado |
| `supabase/functions/cs-daily-briefing/index.ts` | Editar | Filtro empresa em cs_incidents |
| `supabase/functions/revenue-forecast/index.ts` | Editar | Filtro targetEmpresa em wonDeals e lostDeals |
| `supabase/functions/cs-trending-topics/index.ts` | Editar | Agrupar por empresa + salvar separado |
| `.lovable/plan.md` | Editar | Marcar Fase 3 como concluida |

Serao editados 10 arquivos nesta rodada. Nenhuma migracao SQL necessaria.

