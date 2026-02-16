

# Auditoria Pos-Fase G — Plano de Correcao

## Diagnostico

A varredura identificou 3 niveis de prioridade. Apos investigacao do codigo:

### Prioridade 0 — ESLint (Bloqueador CI)

O relatorio menciona 4 erros de ESLint. Como nao consigo executar o linter diretamente, vou revisar as regras ativas e corrigir os padroes mais provaveis de erro:

- Verificar se ha imports nao utilizados ou variaveis declaradas sem uso nos arquivos `src/`
- Revisar os 2 `eslint-disable` existentes (`useLeadsQuentes.ts` e `supabase-mock.ts`) para garantir que estao justificados
- Executar uma varredura manual nos arquivos mais recentes para identificar violacoes

**Acao:** Corrigir todos os erros encontrados para garantir build limpo em CI.

### Prioridade 1 — tokeniza-offers e config.ts

Apos inspecao, `tokeniza-offers/index.ts` ja utiliza `createLogger` do `logger.ts`. Ele nao usa `config.ts` porque nao precisa de variaveis de ambiente nem cliente Supabase. Portanto, **nenhuma acao necessaria** neste item — a funcao ja segue o padrao.

### Prioridade 2 — Migrar console.log do backend para logger estruturado

Foram encontradas **~20 ocorrencias** de `console.log` em 5 arquivos do backend:

| Arquivo | Ocorrencias |
|---------|-------------|
| `sgt-webhook/cadence.ts` | 9 |
| `sgt-webhook/classification.ts` | 3 |
| `_shared/pipeline-routing.ts` | 5 |
| `_shared/phone-utils.ts` | 2 |
| `email-send/index.ts` | 4 |

**Nota:** `_shared/logger.ts` usa `console.log` internamente como mecanismo de output — esse e intencional e nao sera alterado.

**Acao:** Substituir todas as chamadas `console.log(...)` por `log.info(...)` ou `log.debug(...)` usando o logger estruturado de cada funcao. Para arquivos `_shared`, importar e criar instancia local do logger.

## Implementacao

### Passo 1 — Corrigir ESLint (4 erros)
- Identificar e corrigir os erros especificos (provavelmente imports nao utilizados ou violacoes de tipo)
- Garantir 0 erros no lint

### Passo 2 — Migrar console.log no backend
- `sgt-webhook/cadence.ts`: Importar logger e substituir 9 `console.log` por `log.info`/`log.debug`
- `sgt-webhook/classification.ts`: Substituir 3 `console.log` por `log.info`/`log.debug`
- `_shared/pipeline-routing.ts`: Criar logger local e substituir 5 `console.log`
- `_shared/phone-utils.ts`: Criar logger local e substituir 2 `console.log`
- `email-send/index.ts`: Substituir 4 `console.log` por chamadas ao logger existente

### Passo 3 — Deploy das Edge Functions alteradas
- Deploy automatico das funcoes modificadas: `sgt-webhook`, `email-send`

### Passo 4 — Validacao
- Confirmar 0 erros ESLint
- Confirmar 0 `console.log` remanescentes no backend (exceto `logger.ts`)

## Resultado Esperado

- Build 100% limpo para CI/CD
- 0 `console.log` no backend (padrao de observabilidade completo)
- Sistema pronto para deploy sem bloqueadores

