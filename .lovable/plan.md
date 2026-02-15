

# Correção de Problemas Detectados Pós-Migração

Investigação completa revelou **2 bugs introduzidos pela migração** e **3 funções que ficaram de fora** da migração para `callAI()`.

---

## Problemas Encontrados

| Problema | Severidade | Causa | Impacto |
|----------|-----------|-------|---------|
| `deal-scoring` retorna 500 | ALTA | Query usa `pipeline_stages!inner` mas existem 3 FKs ambíguas | Scoring de deals não funciona |
| Operational Health mostra "Erro" para Claude, Gemini, SMTP, Zadarma | MEDIA | Hook envia nomes (`claude`, `smtp`) que a função não reconhece | Dashboard de saúde incompleto |
| 3 funções não migradas para `callAI()` | MEDIA | `copilot-proactive`, `faq-auto-review`, `next-best-action` | Sem rate limiting nem telemetria unificada |
| `email-send` erro SMTP | BAIXA | Configuração TLS do servidor SMTP (pré-existente) | Emails não enviados |
| `cadence-runner` 401 | BAIXA | Auth issue no CRON (pré-existente) | Cadências não executam via CRON |

---

## Correções a Implementar

### 1. Fix `deal-scoring` — Query ambígua (CRÍTICO)

**Arquivo:** `supabase/functions/deal-scoring/index.ts`

Trocar `pipeline_stages!inner` por `pipeline_stages!deals_stage_id_fkey` na query de deals:

```text
ANTES: pipeline_stages!inner(id, nome, posicao, pipeline_id)
DEPOIS: pipeline_stages!deals_stage_id_fkey(id, nome, posicao, pipeline_id)
```

### 2. Fix `integration-health-check` — Adicionar aliases de nomes

**Arquivo:** `supabase/functions/integration-health-check/index.ts`

Adicionar cases no switch para os nomes usados pelo frontend:
- `claude` -> `checkAnthropic()`
- `smtp` -> `checkSMTP()`
- `zadarma` -> verificar se `ZADARMA_API_KEY` existe (mesmo padrão do SGT)

Atualmente o switch já trata `gemini` e `gpt` como aliases de `anthropic`, mas falta `claude`, `smtp` e `zadarma`.

### 3. Migrar 3 funções restantes para `callAI()`

**Arquivos:**
- `supabase/functions/copilot-proactive/index.ts` — substituir bloco de fetch direto por `callAI()`
- `supabase/functions/faq-auto-review/index.ts` — substituir bloco de fetch direto por `callAI()`
- `supabase/functions/next-best-action/index.ts` — substituir bloco de fetch direto por `callAI()`

Mesma abordagem da migração anterior: importar `callAI`, remover fetch manual e log de telemetria manual.

---

## Itens pré-existentes (NÃO causados pela migração)

- **`email-send` SMTP**: Erro de TLS (`InvalidContentType`). Requer revisão das credenciais SMTP (host, porta, tipo de conexão). Não foi alterado na migração.
- **`cadence-runner` 401**: O CRON job pode estar usando um token expirado ou header de auth incorreto. Não foi alterado na migração.

---

## Resumo de arquivos a modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/deal-scoring/index.ts` | Fix query ambígua (1 linha) |
| `supabase/functions/integration-health-check/index.ts` | Adicionar aliases `claude`, `smtp`, `zadarma` |
| `supabase/functions/copilot-proactive/index.ts` | Migrar para `callAI()` |
| `supabase/functions/faq-auto-review/index.ts` | Migrar para `callAI()` |
| `supabase/functions/next-best-action/index.ts` | Migrar para `callAI()` |

