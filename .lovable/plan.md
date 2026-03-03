

## Diagnóstico: Copilot "Travando"

### Causa Raiz Identificada

O travamento acontece porque **todas as operações antes do streaming são sequenciais** e bloqueiam o envio do primeiro byte ao cliente:

```text
Auth check (1-2s)
  → Prompt versions lookup (0.5s)
    → Enrichment context (2-5s, múltiplas queries DB)
      → knowledge-search fetch (3-10s, cold start de outra edge function)
        → Anthropic API first token (3-8s)
```

**Tempo total antes do primeiro token: 10-25s.** Durante esse tempo, o usuário vê apenas os dots de loading sem nenhum conteúdo. Se qualquer etapa demorar mais, a edge function atinge o timeout de 30s e morre — resultando em "travamento" sem resposta.

Problemas adicionais:
1. `knowledge-search` é chamado via HTTP para outra edge function (cold start duplo)
2. Enrichment e coaching RAG são sequenciais (poderiam ser paralelos)
3. Nenhum timeout no fetch ao `knowledge-search` — se travar, trava tudo
4. Nenhum timeout no fetch ao Anthropic

### Plano de Correção

**1. Paralelizar enrichment + coaching RAG** (`supabase/functions/copilot-chat/index.ts`)

Executar `enrichment` e `knowledge-search` em paralelo com `Promise.all()`, em vez de sequencialmente. Isso economiza 3-10s.

**2. Adicionar timeout ao knowledge-search** (`supabase/functions/copilot-chat/index.ts`)

Adicionar `AbortController` com timeout de 4s no fetch ao `knowledge-search`. Se demorar, segue sem coaching (graceful degradation).

**3. Adicionar timeout ao Anthropic fetch** (`supabase/functions/copilot-chat/index.ts`)

Adicionar timeout de 20s para a chamada ao Anthropic. Se expirar, cai no fallback `callAI`.

**4. Frontend: timeout de segurança** (`src/components/copilot/CopilotPanel.tsx`)

Adicionar timeout de 25s no frontend. Se o stream não iniciar (nenhum dado recebido) em 25s, abortar e mostrar mensagem de erro ao usuário em vez de ficar travado indefinidamente.

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/copilot-chat/index.ts` | Paralelizar enrichment+RAG; timeouts no knowledge-search (4s) e Anthropic (20s) |
| `src/components/copilot/CopilotPanel.tsx` | Timeout de segurança de 25s no streaming |

