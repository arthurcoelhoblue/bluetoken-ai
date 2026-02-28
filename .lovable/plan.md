

# Orquestrador tokeniza-gov-sync + cron diário

## O que será feito

### 1. Criar edge function `tokeniza-gov-sync-orchestrator`
Uma função leve que chama `tokeniza-gov-sync` sequencialmente, página por página (500 investidores cada), até `has_more = false`. Usa `fetch()` interno para chamar a própria função de sync.

- Busca página 0 → lê `has_more` e `next_page` → chama página 1 → repete
- Timeout safety: máximo 25 páginas por execução (12.500 investidores)
- Retorna stats consolidados de todas as páginas

### 2. Registrar cron job diário via pg_cron
SQL (via insert tool, não migration) para agendar execução diária às 04:00 UTC:
```sql
SELECT cron.schedule(
  'tokeniza-gov-daily-sync',
  '0 4 * * *',
  $$ SELECT net.http_post(
    url := '...',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ..."}'::jsonb,
    body := '{}'::jsonb
  ) $$
);
```

### 3. Adicionar ao `config.toml`
```toml
[functions.tokeniza-gov-sync-orchestrator]
verify_jwt = false
```

### Detalhes técnicos
- O orchestrator faz fetch interno para `${SUPABASE_URL}/functions/v1/tokeniza-gov-sync` com `Authorization: Bearer ${SERVICE_ROLE_KEY}` e body `{ page: N, page_size: 500 }`
- Consolida stats de todas as páginas num único response
- Cron chama o orchestrator (não o sync direto), garantindo processamento completo

