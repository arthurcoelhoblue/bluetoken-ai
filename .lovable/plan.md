

# Fase A+B+C Restante — Migrar 8 funcoes finais + Fase D inicio

## Resumo

Restam **8 edge functions** sem migracao para config centralizado + logger + eliminacao de `any`. Apos isso, Fase A e C ficam 100%.

## Funcoes a migrar (Fase A + C)

| Funcao | Deno.env.get | console.* | `: any` |
|---|---|---|---|
| sdr-ia-interpret | 6 | 8 | 5 |
| sdr-intent-classifier | 11 | muitos | ~55 |
| notify-closer | 6 | varios | poucos |
| pipedrive-sync | 5 | varios | poucos |
| integration-health-check | 52 | varios | poucos |
| weekly-report | 6 | varios | 1 |
| zadarma-proxy | 11 | varios | poucos |
| zadarma-webhook | 6 | varios | poucos |
| tokeniza-offers | 6 | varios | poucos |

## Acoes por funcao

### 1. sdr-ia-interpret (301 linhas)
- Substituir `SUPABASE_URL()` / `SERVICE_KEY()` por `envConfig`
- Substituir `createClient(...)` por `createServiceClient()`
- Substituir `console.*` por `log.*` (createLogger)
- Tipar `callFunction` — `body: Record<string, unknown>`, retorno `Promise<Record<string, unknown>>`
- Tipar `message` e `aiResponse` em `saveInterpretation` com interfaces inline

### 2. sdr-intent-classifier (562 linhas)
- Substituir `Deno.env.get` por `envConfig` / `getOptionalEnv`
- Substituir `createClient(...)` por `createServiceClient()`
- Adicionar `createLogger`
- Reduzir `any` nos pontos mais criticos: `normalizeSubKeys(obj: unknown)`, `formatTokenizaOffersForPrompt(ofertas: unknown[])`, `jsonResponse(data: unknown)`, filter callbacks

### 3-9. notify-closer, pipedrive-sync, integration-health-check, weekly-report, zadarma-proxy, zadarma-webhook, tokeniza-offers
- Mesmo padrao: `envConfig` + `createServiceClient()` + `createLogger`
- `integration-health-check` tem 52 chamadas — as que checam chaves opcionais usarao `getOptionalEnv()`
- `weekly-report` tem 1 `any` para eliminar

## Resultado esperado

- **Fase A**: 46/46 funcoes migradas (100%)
- **Fase C**: 46/46 funcoes com logger estruturado (100%)
- **Fase B**: Eliminacao significativa de `any` no backend (sdr-intent-classifier e mais ~60 ocorrencias removidas)

## Risco

Baixo. Todas as mudancas sao mecanicas (substituir imports e chamadas). Nenhuma logica de negocio muda.

