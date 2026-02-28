

# Correção dos 2 erros persistentes

## Erro 1: Knowledge Embed — "not a valid ByteString"

**Causa raiz**: O `OPENAI_API_KEY` retornado por `Deno.env.get()` provavelmente contém caracteres invisíveis (newline, espaço, etc.). Quando é interpolado no header `Authorization: Bearer ${openaiKey}`, o Deno rejeita como ByteString inválido.

**Correção**: Na função `generateEmbedding` (linha 103-114), aplicar `.trim()` no parâmetro `openaiKey` antes de usá-lo no header. Também aplicar `.trim()` na leitura inicial do env (linha 188).

## Erro 2: Meta Sync — "Load failed"

**Causa raiz**: A requisição PATCH para `whatsapp-template-manager` está falhando sem logs de processamento. Os logs mostram apenas boot/shutdown, indicando que a função provavelmente está atingindo o timeout de 30s ao buscar 250 templates da Meta API, ou a conexão está sendo cortada antes de completar. Além disso, o `whatsapp-template-manager` usa o `cors.ts` compartilhado que restringe CORS a domínios `.lovable.app` e `.lovableproject.com` — o que deveria funcionar, mas a ausência total de logs de request sugere que a função nem chega a processar.

**Correção**: Adicionar logs de diagnóstico no handler PATCH do `whatsapp-template-manager` para identificar exatamente onde falha, e adicionar timeout nas chamadas à Meta API (25s) para evitar que ultrapasse os 30s do edge function.

## Plano de implementação

1. **Corrigir `knowledge-embed/index.ts`**: Aplicar `.trim()` no `OPENAI_API_KEY` na linha 188 e na função `generateEmbedding`
2. **Corrigir `whatsapp-template-manager/index.ts`**: Adicionar timeout de 25s nas chamadas `fetch` à Meta API e logs de diagnóstico no handler PATCH
3. **Redeploy** ambas as funções e testar

