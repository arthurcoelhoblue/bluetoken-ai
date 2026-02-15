

# Fase 1.2 - Rate Limiting nos Webhooks Publicos

Adicionar protecao contra abuso (flood/replay) nos 3 webhooks publicos que aceitam chamadas externas sem limite de requisicoes.

---

## Problema Atual

Os webhooks `sgt-webhook`, `whatsapp-inbound` e `bluechat-inbound` possuem autenticacao (token/API key) mas nenhum controle de volume de requisicoes. Um atacante com um token valido (ou em caso de vazamento) pode:

- Criar milhares de leads falsos via SGT
- Inundar o pipeline de mensagens via WhatsApp inbound
- Sobrecarregar o SDR IA via Blue Chat

O sistema ja possui rate limiting para chamadas de IA (`ai_rate_limits`), mas nao para os endpoints webhook em si.

---

## Estrategia

Criar um modulo compartilhado `_shared/webhook-rate-limit.ts` que implementa rate limiting por IP + token usando a tabela existente do banco (nova tabela `webhook_rate_limits`) com janela deslizante por minuto.

---

## Implementacao

### 1. Nova tabela: `webhook_rate_limits`

```text
webhook_rate_limits
  id            uuid PK default gen_random_uuid()
  function_name text NOT NULL
  identifier    text NOT NULL (IP ou token hash)
  window_start  timestamptz NOT NULL
  call_count    int default 1
  created_at    timestamptz default now()

  UNIQUE(function_name, identifier, window_start)
```

- RLS desabilitado (somente service_role acessa)
- Index em `(function_name, identifier, window_start)`
- Limpeza automatica: registros com `window_start < now() - interval '1 hour'` podem ser purgados via cron futuro

### 2. Novo arquivo: `supabase/functions/_shared/webhook-rate-limit.ts`

Funcao exportada:

```text
checkWebhookRateLimit(supabase, functionName, identifier, maxPerMinute)
  -> { allowed: boolean, currentCount: number, limit: number }
```

Logica:
- Calcula `window_start` arredondando para o minuto atual
- Faz upsert na tabela (insert on conflict increment)
- Se `call_count > maxPerMinute`, retorna `allowed: false`
- Em caso de erro no banco, permite a requisicao (fail-open para nao bloquear webhooks legitimos)

### 3. Limites por webhook

| Webhook | Limite | Identificador |
|---------|--------|---------------|
| sgt-webhook | 120/min | hash do token x-webhook-secret |
| whatsapp-inbound | 200/min | hash do token WHATSAPP_INBOUND_SECRET + telefone do payload |
| bluechat-inbound | 150/min | empresa (TOKENIZA ou BLUE) |

Esses limites sao generosos o suficiente para operacao normal mas bloqueiam floods.

### 4. Integracao nos webhooks

Cada webhook recebe 3 linhas adicionais apos a validacao de autenticacao:

```text
const rateCheck = await checkWebhookRateLimit(supabase, 'sgt-webhook', tokenHash, 120);
if (!rateCheck.allowed) {
  return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: corsHeaders });
}
```

### 5. Response padrao para rate limit

HTTP 429 com corpo:
```text
{ "error": "Rate limit exceeded", "retryAfter": 60 }
```

Header `Retry-After: 60` incluido.

---

## Fase 3.3 - N+1 Query Optimization (Nota)

Apos analise detalhada dos hooks, os principais (useLeadDetail, useDealDetail, useContactsPage, useOrganizationsPage) ja utilizam:
- Queries paralelas via useQuery independentes (nao sequenciais)
- Views materializadas (deals_full_detail)
- Joins inline (profiles:user_id)
- Paginacao com .range()

Nao ha padroes N+1 significativos para corrigir. Esta fase sera marcada como **nao aplicavel** no plano.

---

## Sequencia de Execucao

1. Criar migracao com tabela `webhook_rate_limits`
2. Criar `_shared/webhook-rate-limit.ts`
3. Integrar em `sgt-webhook/index.ts`
4. Integrar em `whatsapp-inbound/index.ts`
5. Integrar em `bluechat-inbound/index.ts`
6. Deploy das 3 funcoes
7. Validar via logs que requests normais passam
8. Atualizar `.lovable/plan.md` marcando 1.2 como concluido e 3.3 como nao aplicavel

## Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|----------|
| Bloquear webhook legitimo | Fail-open: se o banco falhar no check, permite a requisicao |
| Limites muito agressivos | Valores conservadores (120-200/min) — muito acima do uso normal |
| Latencia adicional | Uma unica query upsert por request (~2ms) |

## Resultado Esperado

- 3 webhooks publicos protegidos contra flood
- Tabela de auditoria de volume por endpoint
- Zero impacto em operacao normal
- Fase 3.3 (N+1) encerrada como nao aplicavel

