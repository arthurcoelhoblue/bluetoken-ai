

# Downgrade "Erro no disparo" no cadence-runner

## Contexto

O cadence-runner registra 100% de falhas (25/25 runs) porque leads nao possuem conversa BlueChat ativa. No momento isso e esperado (ambiente de testes/pre-producao). Em producao sera critico e devera ser monitorado, mas nao como erro de sistema — e sim como metrica operacional.

## Correcao

### Arquivo: `supabase/functions/cadence-runner/index.ts`

**Linha ~637** — Alterar `log.error` para `log.warn` no bloco de "Erro no disparo":

```typescript
// De:
log.error('Erro no disparo', { error: disparo.error });

// Para:
log.warn('Disparo não realizado (pré-condição não atendida)', { error: disparo.error });
```

Isso mantém o registro nos logs estruturados (visível para auditoria) sem disparar alertas no Sentry.

## Resultado

- Sentry limpo: zero alertas para leads sem conversa ativa
- Logs preservados como `WARN` para monitoramento operacional
- Quando o sistema entrar em producao, basta promover de `log.warn` para `log.error` se o volume de warnings indicar problema real

