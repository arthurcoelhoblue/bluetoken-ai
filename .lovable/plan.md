
# Etapa 2A + 2B: Tenant Helper + Edge Functions Prioritarias

## Objetivo

Criar o modulo `_shared/tenant.ts` e refatorar as 5 edge functions que fazem queries cross-tenant (sem filtro `empresa`) usando `createServiceClient()` (que bypassa RLS).

## Por que e necessario

Edge functions usam `service_role` key, que ignora RLS. Portanto, mesmo com RLS perfeito, as edge functions precisam filtrar por `empresa` explicitamente em cada query. Varias funcoes hoje buscam dados de todas as empresas indiscriminadamente.

## 2A — Criar `_shared/tenant.ts`

Novo arquivo: `supabase/functions/_shared/tenant.ts`

Funcionalidade:
- Helper `withTenant(query, empresa)` que adiciona `.eq('empresa', empresa)` de forma padronizada
- Helper `assertEmpresa(empresa)` que valida se o valor e um tenant valido ('BLUE' | 'TOKENIZA')
- Helper `extractEmpresa(req, supabase)` que extrai empresa do body da request ou do token JWT do usuario autenticado

## 2B — Refatorar 5 Edge Functions Prioritarias

### 1. `icp-learner`
**Problema**: Busca deals ganhos/perdidos de TODAS as empresas sem filtro.
**Correcao**: Receber `empresa` no body, filtrar deals via `contacts!inner(empresa)` e salvar resultado separado por empresa em `system_settings`.

### 2. `deal-scoring`
**Problema**: Busca todos os deals abertos sem filtro de empresa. Tambem busca `deal_stage_history` e `pipeline_stages` globalmente.
**Correcao**: Adicionar filtro via pipeline empresa. Receber `empresa` opcional no body para modo batch.

### 3. `deal-loss-analysis`
**Problema**: Modo `portfolio` aceita `empresa` no body mas nao filtra os deals por ela. Modo individual tambem nao valida.
**Correcao**: Aplicar filtro `contacts!inner(empresa)` quando `empresa` e fornecido. Tornar `empresa` obrigatorio no modo portfolio.

### 4. `cs-churn-predictor`
**Problema**: Busca TODOS os `cs_customers` ativos sem filtro de empresa.
**Correcao**: Ja tem `empresa` no customer. Nao precisa de filtro no SELECT (processa todos), mas validar que notificacoes e updates respeitam o tenant. Baixa prioridade — funcao CRON que opera sobre todos os tenants intencionalmente.

### 5. `cs-health-calculator`
**Problema**: Similar ao churn-predictor — busca todos os customers.
**Correcao**: Mesmo caso — funcao CRON que intencionalmente processa todos. Ja isola por `customer_id` nas sub-queries. Manter como esta.

**Reavaliacao**: `cs-churn-predictor` e `cs-health-calculator` sao funcoes CRON que DEVEM processar todos os tenants. O isolamento ja acontece naturalmente por `customer_id`. Substituir por:

### 4 (revisado). `follow-up-scheduler`
**Problema**: Busca `lead_messages` de todas as empresas sem filtro, mesmo recebendo `empresa` no body.
**Correcao**: Quando `empresa` e fornecido, filtrar as mensagens por empresa. Filtrar tambem o upsert.

### 5 (revisado). `copilot-proactive`
**Problema**: Recebe `empresa` mas pode gerar insights sem filtrar adequadamente.
**Correcao**: Verificar e garantir filtro empresa em todas as queries.

## Detalhes Tecnicos

### Arquivos criados
- `supabase/functions/_shared/tenant.ts` (novo)

### Arquivos editados
- `supabase/functions/icp-learner/index.ts`
- `supabase/functions/deal-scoring/index.ts`
- `supabase/functions/deal-loss-analysis/index.ts`
- `supabase/functions/follow-up-scheduler/index.ts`
- `supabase/functions/copilot-proactive/index.ts`
- `.lovable/plan.md`

### Padrao de correcao

Antes:
```text
supabase.from('deals').select('...').eq('status', 'GANHO')
```

Depois:
```text
supabase.from('deals').select('..., contacts!inner(empresa)')
  .eq('contacts.empresa', empresa)
  .eq('status', 'GANHO')
```

Ou para tabelas com `empresa` direta:
```text
supabase.from('lead_messages').select('...')
  .eq('empresa', empresa)
```

### Funcoes CRON (nao refatoradas)

`cs-churn-predictor`, `cs-health-calculator`, `cs-incident-detector`, `cs-renewal-alerts`, `cadence-runner`, `weekly-report` sao funcoes CRON que intencionalmente operam em todos os tenants e ja isolam dados por `customer_id` ou `empresa` internamente. Nao precisam de refatoracao.

