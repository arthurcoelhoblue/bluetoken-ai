

# Blindagem Anti-Limbo: Retry + Reconciliação

## Problema

A `autoCreateDealIfNeeded` no `whatsapp-inbound` é fire-and-forget com 6 pontos de falha silenciosa (trigger pendente, pipeline/stage/owner não encontrado, erro de insert, timeout). Se falhar, a conversa fica sem deal permanentemente.

## Plano

### 1. Retry com backoff no `autoCreateDealIfNeeded` (whatsapp-inbound)

Substituir o `setTimeout(600ms)` fixo por um loop de retry (3 tentativas, delays de 800ms, 1500ms, 3000ms) na etapa de buscar o `contacts` via `legacy_lead_id`. Se após 3 tentativas o contact não existir, registrar em uma tabela de falhas para reconciliação.

### 2. Tabela `deal_creation_failures` (migration)

```sql
CREATE TABLE public.deal_creation_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  empresa TEXT NOT NULL,
  phone_e164 TEXT,
  motivo TEXT NOT NULL,        -- 'CONTACT_NOT_FOUND', 'NO_PIPELINE', 'NO_STAGE', 'NO_OWNER', 'INSERT_ERROR'
  tentativas INT DEFAULT 1,
  resolvido BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
```

Com RLS para admins e índice em `resolvido = false`.

### 3. Registrar falhas ao invés de `return` silencioso

Em cada ponto de falha da `autoCreateDealIfNeeded` (pipeline não encontrado, stage não encontrado, owner indisponível, erro de insert), ao invés de apenas logar e retornar, inserir um registro na `deal_creation_failures` com o motivo específico.

### 4. Edge function `deal-reconciler` (CRON a cada 10min)

Nova edge function que:
1. Busca registros em `deal_creation_failures` onde `resolvido = false` e `tentativas < 5`
2. Para cada um, re-executa a lógica de criação de deal (buscar contact, pipeline, stage, owner, insert)
3. Se sucesso: marca `resolvido = true, resolved_at = now()`
4. Se falha: incrementa `tentativas`
5. Se `tentativas >= 5`: loga alerta e cria notificação para admins

### 5. CRON job para o reconciler

```sql
SELECT cron.schedule('deal-reconciler-10min', '*/10 * * * *', ...);
```

### 6. Notificação para admin quando falha persiste

Após 5 tentativas falhadas, inserir na tabela `notifications` um alerta para todos os admins da empresa: "Lead X está sem deal vinculado — ação manual necessária".

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/whatsapp-inbound/index.ts` | Retry com backoff + registrar falhas em `deal_creation_failures` |
| `supabase/functions/deal-reconciler/index.ts` | **Novo** — CRON reconciliador |
| Migration SQL | Tabela `deal_creation_failures` + RLS |
| CRON SQL | Agendar `deal-reconciler` a cada 10min |

