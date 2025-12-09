# PATCH 5E – Execução Automática do Cadence Runner (CRON JOB)

## Metadados
- **Data**: 2024-12-09
- **Épico**: Motor de Mensagens
- **Status**: ✅ Implementado
- **Dependências**: PATCH 5A (Infraestrutura de Mensagens)

---

## 1. Objetivo

Habilitar a execução automática do motor de cadências (`cadence-runner`) através de um CRON job Supabase, garantindo que:
- Todos os steps vencidos sejam processados no tempo correto
- A cadência avance sem intervenção humana
- Mensagens sejam enviadas automaticamente
- O SDR IA funcione como sistema vivo, e não manual

**Sem este patch, nenhum estímulo do SDR IA é automático.**

---

## 2. Componentes Implementados

### 2.1 Tabela `cadence_runner_logs`

```sql
CREATE TABLE public.cadence_runner_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz NOT NULL DEFAULT now(),
  steps_executed int NOT NULL DEFAULT 0,
  errors int NOT NULL DEFAULT 0,
  runs_touched int NOT NULL DEFAULT 0,
  duration_ms int DEFAULT NULL,
  details jsonb DEFAULT NULL,
  trigger_source text DEFAULT 'CRON' -- CRON, MANUAL, TEST
);
```

### 2.2 Autenticação do Runner

O `cadence-runner` agora valida autenticação obrigatória:

```typescript
function validateServiceRoleAuth(req: Request): boolean {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CRON_SECRET");
  
  return token === serviceRoleKey || token === cronSecret;
}
```

**Aceita:**
- `SUPABASE_SERVICE_ROLE_KEY` - para chamadas internas
- `CRON_SECRET` - para chamadas do pg_cron

### 2.3 Lock Otimista

Previne execução duplicada usando comparação atômica:

```typescript
const { data: locked } = await supabase
  .from('lead_cadence_runs')
  .update({ next_run_at: lockTime })
  .eq('id', run.id)
  .eq('next_run_at', run.next_run_at) // Só atualiza se não mudou
  .select()
  .maybeSingle();

if (!locked) {
  // Outra instância já está processando
  return { status: 'SKIPPED' };
}
```

---

## 3. CRON Job

### 3.1 Configuração SQL

```sql
SELECT cron.schedule(
  'cadence-runner-cron',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT net.http_post(
    url := 'https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/cadence-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    ),
    body := '{"trigger": "CRON"}'::jsonb
  ) AS request_id;
  $$
);
```

### 3.2 Periodicidade

| Expressão | Descrição |
|-----------|-----------|
| `*/5 * * * *` | A cada 5 minutos |
| `*/1 * * * *` | A cada 1 minuto (alta frequência) |
| `0 * * * *` | A cada hora (baixa frequência) |

---

## 4. Fluxo de Execução

```
1. CRON dispara HTTP POST para /cadence-runner
   ↓
2. Validar autenticação (SERVICE_ROLE ou CRON_SECRET)
   ↓
3. Buscar runs com status=ATIVA e next_run_at <= now()
   ↓
4. Para cada run:
   a. Tentar lock otimista (atualiza next_run_at)
   b. Se lock falhou → SKIP (outra instância processando)
   c. Buscar step atual e contato do lead
   d. Resolver template e disparar mensagem
   e. Atualizar run (próximo step ou concluída)
   ↓
5. Registrar log de execução em cadence_runner_logs
   ↓
6. Retornar resumo da execução
```

---

## 5. Logs de Execução

### 5.1 Estrutura do Log

```json
{
  "executed_at": "2024-12-09T10:05:00Z",
  "steps_executed": 12,
  "errors": 1,
  "runs_touched": 7,
  "duration_ms": 2340,
  "trigger_source": "CRON",
  "details": {
    "results": [...],
    "started_at": "2024-12-09T10:05:00Z",
    "finished_at": "2024-12-09T10:05:02Z"
  }
}
```

### 5.2 Trigger Sources

| Valor | Descrição |
|-------|-----------|
| `CRON` | Execução automática via pg_cron |
| `MANUAL` | Chamada manual via API |
| `TEST` | Teste de desenvolvimento |

---

## 6. Tratamento de Erros

| Situação | Comportamento |
|----------|---------------|
| Contato não encontrado | Evento ERRO + retry em 30min |
| Template não encontrado | Evento ERRO + retry em 30min |
| Erro no disparo | Evento ERRO + retry em 15min |
| Lock falhou | SKIP - outra instância processando |
| Erro geral | Log registrado + 500 response |

---

## 7. Q&A de Testes

### Execução Automática

| Teste | Resultado Esperado |
|-------|-------------------|
| CRON dispara a cada 5 min | Log aparece em `cadence_runner_logs` |
| Runner processa steps vencidos | Mensagens enviadas automaticamente |
| Runner sem steps vencidos | Executa vazio, log com `runs_touched: 0` |

### Autorização

| Teste | Resultado Esperado |
|-------|-------------------|
| Chamada sem Authorization | 401 Unauthorized |
| Chamada com ANON_KEY | 401 Unauthorized |
| Chamada com SERVICE_ROLE | 200 OK |
| Chamada com CRON_SECRET | 200 OK |

### Idempotência

| Teste | Resultado Esperado |
|-------|-------------------|
| Duas chamadas simultâneas | Apenas 1 processa, outra retorna SKIPPED |
| Step executado 2x no mesmo minuto | Apenas 1 envio realizado |

---

## 8. Monitoramento

### 8.1 Query de Status

```sql
-- Últimas 10 execuções
SELECT 
  executed_at,
  steps_executed,
  errors,
  runs_touched,
  duration_ms,
  trigger_source
FROM cadence_runner_logs
ORDER BY executed_at DESC
LIMIT 10;
```

### 8.2 Query de Erros

```sql
-- Execuções com erros nas últimas 24h
SELECT *
FROM cadence_runner_logs
WHERE errors > 0
AND executed_at > now() - interval '24 hours'
ORDER BY executed_at DESC;
```

### 8.3 Verificar CRON Job

```sql
-- Listar jobs agendados
SELECT * FROM cron.job;

-- Histórico de execuções do CRON
SELECT * FROM cron.job_run_details
WHERE jobname = 'cadence-runner-cron'
ORDER BY start_time DESC
LIMIT 10;
```

---

## 9. Como Ativar o CRON

Execute o SQL abaixo no Supabase (SQL Editor):

```sql
-- 1. Configurar o CRON_SECRET (substitua pelo valor real)
ALTER DATABASE postgres SET "app.settings.cron_secret" = 'SEU_CRON_SECRET_AQUI';

-- 2. Criar o CRON job
SELECT cron.schedule(
  'cadence-runner-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/cadence-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    ),
    body := '{"trigger": "CRON"}'::jsonb
  ) AS request_id;
  $$
);
```

---

## 10. Próximos Passos

1. **PATCH 5F**: Webhook Inbound WhatsApp - receber respostas dos leads
2. **PATCH 5D**: Email Outbound via SMTP - enviar emails reais
3. **Dashboard de Métricas**: Visualizar logs e performance

---

## 11. Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/cadence-runner/index.ts` | Autenticação + Logs + Lock otimista |
| `docs/patches/PATCH-5E_cadence-runner-cron.md` | Documentação do patch |

### Migration

```
supabase/migrations/[timestamp]_patch5e_runner_logs.sql
```
- Cria tabela `cadence_runner_logs`
- Configura RLS
- Habilita extensões `pg_cron` e `pg_net`
