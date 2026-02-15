

# Plano V5 Audit — Fechar os 3 itens pendentes

A auditoria V5 identifica 4 pendencias. O item bloqueante (CRON jobs) ja esta resolvido — existem 16 jobs ativos no banco. Restam 3 frentes para chegar ao 9.3+/10.

---

## Status Real vs Auditoria

| Item | Auditoria diz | Realidade | Acao |
|------|--------------|-----------|------|
| CRON Jobs (13+ funcoes) | BLOQUEANTE - zero jobs | 16 jobs ativos no pg_cron | Nenhuma - ja resolvido |
| Rate limiting enforced | Tabela criada, nao enforced | Tabela vazia, 0 funcoes checam | Implementar |
| Migrar 17 funcoes para callAI() | 5/22 usam shared | Confirmado 5/22 | Migrar as 17 restantes |
| Testes SDR + ai-provider | 15 testes, 0 para SDR | Confirmado | Criar testes |

---

## Frente 1: Rate Limiting enforced na callAI() (Prioridade ALTA)

### Arquivo: `supabase/functions/_shared/ai-provider.ts`

Adicionar funcao `checkRateLimit()` que e chamada automaticamente no inicio de `callAI()`:

1. Recebe `user_id` (novo campo opcional em `CallAIOptions`) e `functionName`
2. Faz UPSERT na tabela `ai_rate_limits` incrementando `call_count`
3. Se `call_count` exceder o limite (ex: 100 chamadas por hora por funcao), retorna erro antes de chamar qualquer provider
4. Se `user_id` nao for fornecido (chamadas de CRON/sistema), skip rate limiting

Limites sugeridos por funcao:

| Funcao | Limite/hora |
|--------|------------|
| copilot-chat | 60 |
| sdr-intent-classifier | 200 |
| sdr-response-generator | 200 |
| deal-scoring | 100 |
| Outras | 100 (default) |

A interface `CallAIOptions` ganha o campo opcional `userId?: string`.

### Resultado
- Toda chamada via `callAI()` sera automaticamente protegida
- Funcoes que ainda usam fetch direto nao serao protegidas (incentivo adicional para migrar)
- Tabela `ai_rate_limits` passara a ter dados reais

---

## Frente 2: Migrar 17 funcoes para callAI() (Prioridade MEDIA)

As 17 funcoes que ainda usam fetch direto com fallback manual:

| Funcao | Complexidade |
|--------|-------------|
| deal-scoring | Baixa - prompt unico |
| deal-context-summary | Baixa |
| deal-loss-analysis | Baixa |
| call-coach | Baixa |
| call-transcribe | Baixa |
| cs-health-calculator | Baixa |
| cs-churn-predictor | Baixa |
| cs-daily-briefing | Baixa |
| cs-incident-detector | Baixa |
| cs-nps-auto | Baixa |
| cs-trending-topics | Baixa |
| cs-playbook-runner | Baixa |
| revenue-forecast | Baixa |
| weekly-report | Baixa |
| follow-up-scheduler | Baixa |
| icp-learner | Baixa |
| amelia-learn | Media - multiplas chamadas IA |
| amelia-mass-action | Media - loop com chamadas IA |

Para cada funcao, a migracao consiste em:
1. Adicionar `import { callAI } from "../_shared/ai-provider.ts"`
2. Remover funcoes locais de fallback (callClaude/callGemini/callGPT)
3. Substituir bloco de chamada por uma unica `callAI({ system, prompt, functionName, empresa, supabase })`
4. Remover `ai_usage_log.insert()` manual (ja automatico no callAI)

Cada funcao leva ~5 minutos. Total estimado: ~2 horas.

---

## Frente 3: Testes para modulos SDR + ai-provider (Prioridade MEDIA)

Criar testes unitarios usando Vitest para:

### 3A. `_shared/ai-provider.ts` — Teste de logica interna
- Arquivo: `supabase/functions/_shared/__tests__/ai-provider.test.ts`
- Testar: COST_TABLE calcula custos corretamente
- Testar: Rate limit rejeita quando excede limite
- Testar: Fallback chain (Claude falha -> Gemini tenta)
- Testar: Telemetria e logada mesmo em falha

### 3B. SDR Modules — Testes de integracao leve
- Arquivo: `supabase/functions/sdr-intent-classifier/sdr-intent-classifier.test.ts`
- Testar: Parse de JSON response valido
- Testar: Fallback para classificacao default em caso de IA falha
- Testar: computeClassificationUpgrade retorna upgrade correto para intents de alta confianca

- Arquivo: `supabase/functions/sdr-message-parser/sdr-message-parser.test.ts`
- Testar: Deteccao de urgencia
- Testar: Normalizacao de telefone

- Arquivo: `supabase/functions/sdr-action-executor/sdr-action-executor.test.ts`
- Testar: Classification upgrade e aplicado quando confianca >= 0.8
- Testar: Opt-out cancela cadencias

---

## Ordem de execucao

1. **Frente 1**: Rate limiting no `_shared/ai-provider.ts` (~30 min)
2. **Frente 2**: Migrar as 17 funcoes para `callAI()` (~2h, pode ser feito em 2-3 batches)
3. **Frente 3**: Criar testes (~1h)

## Arquivos modificados/criados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/_shared/ai-provider.ts` | Adicionar `checkRateLimit()` + campo `userId` |
| 17 edge functions | Migrar para `callAI()` |
| 3 arquivos de teste | Criar novos |

## Score esperado apos implementacao

Com CRON ja resolvido + rate limiting + migracao completa + testes: **9.5/10** (production-ready com margem).

