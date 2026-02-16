
# Correção dos Erros Sentry — Pós-Fase G

## Diagnóstico

### Erro 1: `sdr-ia-interpret` — "Error: Error"

**Causa raiz:** A IA (sdr-intent-classifier) retorna valores de ação que **não existem** no enum `sdr_acao_tipo` do banco. Exemplos dos logs:
- `ESCLARECIMENTO_INICIAL`
- `APRESENTAR_CLARIFICAR`
- `RESPONDER_QUALIFICAR`
- `DESQUALIFICAR_LEAD`
- `AGUARDAR_ESCOLHA_DEPARTAMENTO`
- `QUEBRAR_LOOP_AUTOMATICO`

Os valores válidos do enum são apenas 10: `NENHUMA`, `ENVIAR_RESPOSTA_AUTOMATICA`, `CRIAR_TAREFA_CLOSER`, `ESCALAR_HUMANO`, `PAUSAR_CADENCIA`, `CANCELAR_CADENCIA`, `RETOMAR_CADENCIA`, `AJUSTAR_TEMPERATURA`, `MARCAR_OPT_OUT`, `HANDOFF_EMPRESA`.

Quando `saveInterpretation` tenta inserir um valor inválido, o Postgres rejeita e a função lança um erro genérico `Error` que vai para o Sentry.

**Segundo problema:** O catch na linha 292 faz `String(error)` num objeto Supabase, resultando em `[object Object]` — sem informação útil.

### Erro 2: `cadence-runner` — "Erro ao resolver mensagem"

**Causa raiz:** Leads que estão em cadência de WhatsApp/SMS não possuem telefone cadastrado. A função `resolverMensagem` retorna `{success: false, error: "Contato sem telefone"}` e o código trata como `log.error`, disparando Sentry. Isto é um cenário esperado (dados incompletos), não um erro de sistema.

---

## Correções

### 1. sdr-ia-interpret — Normalizar ação da IA antes de salvar

Criar uma função `normalizarAcao()` que mapeia os valores livres da IA para o enum válido:

```text
Mapeamento:
- ESCLARECIMENTO_INICIAL, APRESENTAR_CLARIFICAR, ESCLARECER_SITUACAO,
  APRESENTAR_ESCLARECER, RESPONDER_QUALIFICAR → ENVIAR_RESPOSTA_AUTOMATICA
- DESQUALIFICAR_LEAD → MARCAR_OPT_OUT
- AGUARDAR_ESCOLHA_DEPARTAMENTO, RESPONDER_DEPARTAMENTO_COMERCIAL → ESCALAR_HUMANO
- QUEBRAR_LOOP_AUTOMATICO → PAUSAR_CADENCIA
- Qualquer outro valor desconhecido → NENHUMA
```

Aplicar esta normalização em `saveInterpretation` antes do insert no campo `acao_recomendada`.

### 2. sdr-ia-interpret — Corrigir log do catch

Melhorar a serialização do erro no catch principal (linha 292) para exibir o erro real em vez de `[object Object]`:

```typescript
// De:
log.error('Error', { error: error instanceof Error ? error.message : String(error) });
// Para:
const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
log.error('Error', { error: errMsg });
```

### 3. cadence-runner — Downgrade de severidade

Na função `processarRun`, o "Contato sem telefone" é um cenário de dados incompletos, não um erro de sistema. Mudar de `log.error` para `log.warn` para que não dispare alertas no Sentry:

```typescript
// De:
log.error('Erro ao resolver mensagem', { error: mensagemResolvida.error });
// Para:
log.warn('Mensagem não resolvida (dados incompletos)', { error: mensagemResolvida.error });
```

---

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/sdr-ia-interpret/index.ts` | Adicionar `normalizarAcao()` + corrigir serialização do catch |
| `supabase/functions/cadence-runner/index.ts` | Downgrade `log.error` → `log.warn` na resolução de mensagem |

## Resultado Esperado

- Zero alertas Sentry para ações desconhecidas da IA (normalizadas silenciosamente)
- Zero alertas Sentry para leads sem telefone (warning, não error)
- Logs estruturados com mensagens legíveis (sem `[object Object]`)
