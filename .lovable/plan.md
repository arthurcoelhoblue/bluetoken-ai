

## Diagnóstico: Copilot trava no meio da resposta

### Causa raiz (3 problemas)

**1. Backend: Sem timeout de leitura no stream Anthropic**
O timeout de 20s (`anthropicAbort`) é cancelado assim que o `fetch` retorna headers (linha 291). Se o Anthropic **começa** a responder mas **para no meio** (throttling, rede instável), o `reader.read()` fica pendurado para sempre — a edge function morre no timeout de 30s do Deno e o stream é cortado sem `[DONE]`.

**2. Backend: Parsing SSE quebrado entre chunks**
Anthropic envia SSE multi-linha (`event: ...\ndata: ...\n\n`). O código no `pull()` do `ReadableStream` (linhas 325-356) faz `chunk.split('\n')` por chunk individual, sem manter um buffer entre chamadas. Se um evento SSE é dividido entre dois chunks TCP, o `JSON.parse` falha silenciosamente e o delta de texto é perdido — resultado: a resposta "congela" embora dados ainda cheguem.

**3. Frontend: Sem timeout de inatividade no stream**
O timeout de 25s protege apenas o **início** do stream (é cancelado na linha 170 após receber headers). Se dados param de chegar **durante** o streaming, o `reader.read()` fica preso indefinidamente — o usuário vê a resposta parcial congelada sem nenhum feedback.

### Plano de correção

**1. Backend: Buffer SSE persistente entre pulls** (`supabase/functions/copilot-chat/index.ts`)

Manter uma variável `sseBuffer` fora do `pull()` para acumular fragmentos incompletos entre chamadas. Processar apenas linhas completas (terminadas em `\n`).

**2. Backend: Timeout de leitura por chunk** (`supabase/functions/copilot-chat/index.ts`)

Dentro do `pull()`, envolver o `reader.read()` com um `Promise.race` contra um timeout de 10s. Se nenhum dado chegar em 10s, emitir `[DONE]` e fechar o stream graciosamente.

**3. Frontend: Watchdog de inatividade** (`src/components/copilot/CopilotPanel.tsx`)

Após cada `reader.read()` com dados, resetar um timer de 15s. Se 15s passam sem novos dados (e `done` não é true), abortar o controller — o catch mostrará a mensagem de timeout ao usuário.

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/copilot-chat/index.ts` | Buffer SSE persistente + timeout de 10s por read no stream |
| `src/components/copilot/CopilotPanel.tsx` | Watchdog de inatividade de 15s durante streaming |

