

# Correção Definitiva dos 2 Erros

## Erro 1: Meta Sync — PATCH bloqueado pelo CORS

**Causa raiz**: `supabase/functions/_shared/cors.ts` linha 26 define `Access-Control-Allow-Methods: "GET, POST, PUT, DELETE, OPTIONS"` — **PATCH não está listado**. O preflight CORS do navegador rejeita a requisição PATCH antes de chegar ao handler. Por isso zero logs de processamento.

**Correção**: Adicionar `PATCH` à lista de métodos permitidos na linha 26 de `cors.ts`.

## Erro 2: Knowledge Embed — ByteString inválido

**Causa raiz**: `.trim()` remove apenas espaços/tabs/newlines. O secret `OPENAI_API_KEY` contém caracteres Unicode invisíveis (BOM, zero-width space, etc.) que `.trim()` não remove. Deno exige que headers HTTP sejam ByteStrings válidos (apenas 0x00-0xFF).

**Correção**: Em `knowledge-embed/index.ts` e `knowledge-search/index.ts`, substituir `.trim()` por `.replace(/[^\x20-\x7E]/g, '')` para eliminar qualquer caractere não-ASCII/não-imprimível da chave. Isso garante um ByteString válido independente de como o secret foi salvo.

## Implementação

1. **`supabase/functions/_shared/cors.ts`** linha 26: mudar para `"GET, POST, PUT, PATCH, DELETE, OPTIONS"`
2. **`supabase/functions/knowledge-embed/index.ts`** linha 188: mudar `.trim()` para `.replace(/[^\x20-\x7E]/g, '')` e linha 107 idem
3. **`supabase/functions/knowledge-search/index.ts`**: aplicar mesma sanitização na leitura do OPENAI_API_KEY
4. **Redeploy** das 3 funções

