

## Problema

O `copilot-chat` retorna uma resposta **streaming SSE** (Server-Sent Events), mas o `EmailFromDealDialog` chama via `supabase.functions.invoke()` que espera JSON. O resultado é que `data` contém o texto bruto do SSE (ou um ReadableStream), não um objeto `{ content: "..." }`. Por isso `data?.content` é `undefined` e os campos ficam vazios — mesmo com o toast de "sucesso".

O toast "Conteúdo gerado — ajuste o assunto" aparece porque o código cai no bloco `catch` interno (JSON.parse falha no conteúdo SSE) e faz `form.setValue('body', data?.content || '')` — que é string vazia.

## Correção

No `EmailFromDealDialog.tsx`, na função `handleGenerateDraft`:

1. **Ler o SSE corretamente**: Usar `supabase.functions.invoke()` com `{ responseType: 'text' }` (ou equivalente) para obter o corpo como texto
2. **Parsear os chunks SSE**: Extrair o conteúdo dos eventos `data: {...}` do stream, concatenar os deltas de `choices[0].delta.content`
3. **Manter o fallback**: Se o parsing SSE falhar, tentar o formato JSON direto (caso o backend caia no fallback não-streaming)

### Lógica de parsing SSE:

```text
1. Obter resposta como texto bruto
2. Separar por linhas "data: ..."
3. Para cada linha (exceto "data: [DONE]"):
   - Parse JSON → extrair choices[0].delta.content
   - Concatenar no fullContent
4. Tentar extrair JSON {subject, body} do fullContent
5. Preencher os campos do formulário
```

### Arquivo alterado

1. `src/components/deals/EmailFromDealDialog.tsx` — corrigir leitura da resposta SSE do copilot-chat

