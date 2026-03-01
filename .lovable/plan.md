

# Fix: Indexação incremental + batching para evitar CPU timeout

## Problema Raiz
O livro "As armas da persuasão" gerou 402 chunks. A Edge Function processou 390 com sucesso mas foi encerrada por **CPU Time exceeded** antes de finalizar. Como `chunks_count` e `embed_status` só são atualizados na última linha (após todos os chunks), o livro ficou com `chunks_count: 0` e `embed_status: 'processing'`.

## Correção (2 partes)

### 1. Atualizar `chunks_count` incrementalmente durante o processamento
No `embedChunks()`, a cada 20 chunks processados (onde já existe o log de progresso), fazer um UPDATE parcial no `behavioral_knowledge` com o `embedded` acumulado até aquele ponto. Assim, mesmo se a função morrer no meio, o `chunks_count` reflete o progresso real.

```typescript
// Dentro do loop de embedChunks, junto com o log de progresso:
if ((i + 1) % 20 === 0) {
  console.log(`[embed] Progress: ${i+1}/${chunks.length}...`);
  // Atualizar chunks_count parcial se for behavioral
  if (sourceType === 'behavioral') {
    await supabase.from("behavioral_knowledge")
      .update({ chunks_count: embedded })
      .eq("id", sourceId);
  }
}
```

### 2. Processar em batches com resposta antecipada para livros grandes
Para livros com mais de ~250 chunks, a função deve:
- Processar os primeiros N chunks (ex: 200) dentro do request
- Retornar imediatamente com `{ embedded: 200, total: 402, status: 'partial' }`
- Disparar uma segunda chamada via `fetch()` fire-and-forget para continuar do chunk 201 em diante

Isso exige adicionar um parâmetro `start_from` na action `embed_behavioral` e usar o `chunk_index` para saber de onde continuar sem re-deletar embeddings já inseridos.

### 3. Fix imediato: corrigir dados atuais
Atualizar o registro atual para refletir os 390 embeddings que já existem:
```sql
UPDATE behavioral_knowledge 
SET chunks_count = 390, embed_status = 'done' 
WHERE id = '41535467-e403-46f9-9e09-7a4ff2d92854';
```

E o "Previsivelmente Irracional" que também está com status `processing` e 222 embeddings (mas mostra 373):
```sql
UPDATE behavioral_knowledge 
SET chunks_count = 222, embed_status = 'done' 
WHERE id = '91cbbe69-e3e2-42d2-ad72-767dc4c857f3';
```

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/knowledge-embed/index.ts` | Atualização incremental de `chunks_count` + lógica de batching com `start_from` |
| Migration SQL | Fix dos dados atuais (chunks_count e embed_status) |

