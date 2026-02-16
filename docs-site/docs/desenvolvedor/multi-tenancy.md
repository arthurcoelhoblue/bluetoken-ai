---
sidebar_position: 4
title: Multi-tenancy
---

# Multi-tenancy — Schema Views

## Arquitetura

O isolamento multi-tenant usa **Schema Views** ao invés de bancos separados:

```
public (schema)     → Tabelas reais com todos os dados
blue (schema)       → ~57 views filtradas por empresa='BLUE'
tokeniza (schema)   → ~57 views filtradas por empresa='TOKENIZA'
```

## Função de Provisionamento

```sql
SELECT public.provision_tenant_schema('novo_tenant');
```

Esta função:
1. Cria o schema se não existir
2. Gera views `SECURITY INVOKER` para cada tabela
3. Filtra por `empresa` (direto ou via JOINs para tabelas como `pipeline_stages`)
4. Concede permissões adequadas

## Características das Views

- **SECURITY INVOKER** — Respeita RLS do usuário chamador
- **Filtro automático** — Todas filtram por `empresa`
- **Read-only** — Views são para consulta; writes vão direto no `public`
- **~57 views por tenant** — Cobertura completa das tabelas

## Frontend

O frontend continua usando o schema `public` normalmente. As views de tenant são para consultas analíticas e relatórios isolados.

---

## Defesa em Profundidade — Triggers de Validação

Além do RLS e dos filtros em Edge Functions, o sistema possui **triggers SQL** que impedem corrupção cross-tenant em writes críticos:

### `validate_deal_pipeline_tenant`
- **Tabela**: `deals` (BEFORE INSERT OR UPDATE)
- **Regra**: Verifica que o `pipeline_id` pertence à mesma `empresa` do `contact_id`
- Se divergirem, o write é bloqueado com `EXCEPTION`

### `validate_activity_tenant`
- **Tabela**: `deal_activities` (BEFORE INSERT)
- **Regra**: Resolve a empresa do deal associado (via `deals → pipelines`) e valida consistência
- Impede que uma atividade seja criada vinculada a um deal de outro tenant

---

## Edge Functions — Padrão `assertEmpresa`

Todas as Edge Functions que operam com dados de tenant devem:

1. **Importar** o helper: `import { assertEmpresa } from "../_shared/tenant.ts"`
2. **Validar** a empresa antes de qualquer query: `assertEmpresa(empresa)`
3. **Filtrar explicitamente** todas as queries com `.eq('empresa', empresa)` ou `.eq('pipeline_empresa', empresa)`

```typescript
// Exemplo padrão
import { assertEmpresa } from "../_shared/tenant.ts";

const { empresa } = await req.json();
assertEmpresa(empresa);

const { data } = await supabase
  .from('deals')
  .select('*')
  .eq('pipeline_empresa', empresa);  // Filtro explícito obrigatório
```

---

## ADR-005: Filtros Explícitos vs. `createTenantClient`

**Decisão**: Usar filtros explícitos (`.eq('empresa', empresa)`) em cada query ao invés de um `createTenantClient` automático que aplicaria filtros implícitos.

**Alternativas consideradas**:
1. **`createTenantClient`** — Wrapper do Supabase client que injeta `.eq('empresa', ...)` automaticamente em todas as queries
2. **Filtros explícitos** — Cada query adiciona manualmente o filtro de tenant

**Motivação**:
- **Transparência**: Filtros explícitos são visíveis no código, facilitando code review e auditoria
- **Flexibilidade**: Nem todas as tabelas usam `empresa` diretamente — algumas precisam de JOINs (ex: `deals` filtra via `pipeline_empresa`)
- **Sem mágica**: Evita bugs sutis onde o wrapper não aplicaria corretamente o filtro em queries complexas (JOINs, subqueries, RPCs)
- **Facilidade de teste**: Cada query pode ser testada individualmente

**Trade-off**: Mais verbosidade no código, mas maior segurança e previsibilidade.

---

## Status de Cobertura — Edge Functions Hardened

### Grupo A — Funções chamadas pelo frontend (6 funções)

| Função | Status | Validação | Filtros |
|--------|--------|-----------|---------|
| `next-best-action` | ✅ Hardened | `assertEmpresa` | 8 queries filtradas |
| `amelia-mass-action` | ✅ Hardened | `assertEmpresa` do job | queries de deals filtradas |
| `deal-context-summary` | ✅ Hardened | Empresa do contact | 4 queries filtradas |
| `call-coach` | ✅ Hardened | Empresa do deal | `knowledge_products` filtrado |
| `amelia-learn` | ✅ Hardened | `assertEmpresa` | 3 queries corrigidas |
| `cs-suggest-note` | ✅ Hardened | `assertEmpresa` do customer | Validação de tenant |

### Grupo B — CRON/Background Jobs (3 funções)

| Função | Status | Método |
|--------|--------|--------|
| `cs-daily-briefing` | ✅ Hardened | Filtro empresa em `cs_incidents` |
| `revenue-forecast` | ✅ Hardened | Filtro `targetEmpresa` em wonDeals/lostDeals |
| `cs-trending-topics` | ✅ Hardened | Iteração por empresa + chaves separadas |

### Grupo C — Funções previamente hardened (Fase 2)

| Função | Status |
|--------|--------|
| `deal-loss-analysis` | ✅ Hardened |
| `follow-up-scheduler` | ✅ Hardened |
| `deal-scoring` | ✅ Hardened |
