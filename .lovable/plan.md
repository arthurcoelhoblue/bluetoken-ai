

## Plano: Refinamento inteligente via Sonnet + auto-exclusão do PDF

### Conceito

O pipeline fica em duas etapas:
1. **Mecânica (pdf-parse)** — extrai texto bruto do PDF (barato, já existe)
2. **Inteligência (Claude Sonnet)** — recebe os chunks brutos e refina cada um, extraindo pontos relevantes, técnicas práticas e frameworks acionáveis. Chunks irrelevantes (índice, agradecimentos, páginas em branco) são descartados

Após indexação completa: PDF deletado do Storage, registro marcado como `arquivado`, reindexação bloqueada.

### Fluxo técnico

```text
PDF upload → pdf-parse (texto bruto)
          → semanticChunk (chunking mecânico)
          → Claude Sonnet por chunk (refina/descarta)
          → embedding dos chunks refinados
          → delete PDF do Storage
          → marca arquivado = true
```

### Mudanças

| Componente | O que muda |
|---|---|
| **DB Migration** | Adicionar `arquivado BOOLEAN DEFAULT false` à tabela `behavioral_knowledge` |
| **`supabase/functions/knowledge-embed/index.ts`** | Nova função `refineChunkWithSonnet(chunk, bookTitle)` que envia cada chunk ao Claude Sonnet via `ANTHROPIC_API_KEY` (já configurada) com prompt pedindo para extrair técnicas práticas e descartar conteúdo irrelevante. Retorna chunk refinado ou `null` (descartado). Integrar no fluxo `embed_behavioral`: após `semanticChunk`, passar cada chunk pelo Sonnet antes de gerar embeddings. Após último batch concluído (`embed_status = 'done'`): deletar PDF do Storage (`behavioral-books`) e marcar `arquivado = true`, setar `storage_path = null`. Na continuação, se `arquivado = true` ou `storage_path` é null, rejeitar com erro. |
| **`src/components/knowledge/BehavioralKnowledgeTab.tsx`** | Esconder botão de reindexar quando `arquivado = true` ou `storage_path` é null. Mostrar badge "Arquivado" no lugar. Ajustar exclusão para não tentar deletar arquivo se `storage_path` é null. |
| **`src/hooks/useBehavioralKnowledge.ts`** | Adicionar `arquivado` e `storage_path` ao tipo `BehavioralKnowledge`. Ajustar `useDeleteBehavioralBook` para verificar `storagePath` antes de deletar do Storage. |

### Prompt do Sonnet para refinamento

O prompt instrui o modelo a:
- Extrair técnicas, frameworks e dicas acionáveis de vendas
- Descartar conteúdo sem valor prático (índice, copyright, agradecimentos, páginas de referência)
- Manter o conteúdo substancial intacto, apenas enriquecendo com contexto
- Retornar `SKIP` se o chunk não tem valor prático

### Sobre custos

- pdf-parse: custo zero (biblioteca local)
- Sonnet por chunk (~500 tokens input + ~500 output): ~$0.009 por chunk
- Livro médio (~100 chunks): ~$0.90 total de refinamento
- Embedding (OpenAI text-embedding-3-small): custo existente inalterado

