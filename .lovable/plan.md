

# Melhoria Completa do RAG com Machine Learning

## Estado Atual
- **knowledge-embed**: Chunking fixo 500 tokens, embeddings via OpenAI `text-embedding-3-small`, armazenados em `knowledge_embeddings` (pgvector)
- **knowledge-search**: Busca vetorial pura via `search_knowledge_embeddings` (cosine similarity) + fallback keyword rudimentar (substring match)
- **amelia-learn**: Mineracao de padroes (takeovers, perdas, sequencias) — sem conexao com RAG
- **knowledge_gaps**: Registra perguntas sem resposta mas sem auto-resolucao
- **Dados**: 31 secoes, 0 FAQs, 0 embeddings gerados, 0 gaps registrados
- **Secrets**: `OPENAI_API_KEY` e `LOVABLE_API_KEY` disponiveis

---

## Plano de Implementacao (6 etapas)

### 1. Migracao SQL — Hybrid Search + Feedback + Cache

Adicionar ao banco:

- Coluna `fts tsvector` em `knowledge_embeddings` com trigger auto-update (portugues)
- Indice GIN na coluna `fts`
- Tabela `knowledge_search_feedback` (query, chunks_returned, outcome, lead_id, empresa, created_at)
- Tabela `knowledge_query_cache` (query_hash, expanded_query, embedding vector(1536), expires_at)
- Funcao SQL `hybrid_search_knowledge` que combina cosine similarity + full-text search com Reciprocal Rank Fusion (RRF)

### 2. knowledge-embed — Semantic Chunking

Reescrever a logica de fragmentacao:

- Dividir primeiro por paragrafos/secoes naturais (quebras `\n\n`, headings `##`)
- Aplicar limite de tokens apenas se paragrafo exceder 500 tokens
- Prefixar cada chunk com titulo da secao/produto para contexto
- Overlap semantico: ultima frase do chunk anterior como inicio do proximo
- Popular coluna `fts` ao inserir

### 3. knowledge-search — Pipeline Completo

Reescrever com pipeline de 4 etapas:

```
Query → [Expansion] → [Hybrid Search] → [Re-Ranking] → Resultado
```

**3a. Query Expansion**: Usar Lovable AI (`gemini-2.5-flash-lite`) para reescrever queries curtas/ambiguas em versoes mais ricas. Cache de expansoes por hash da query (tabela `knowledge_query_cache`).

**3b. Hybrid Search (RRF)**: Chamar nova funcao SQL `hybrid_search_knowledge` que:
- Executa busca vetorial (cosine similarity) — top 15
- Executa full-text search (tsvector `@@` tsquery) — top 15
- Combina com RRF: `score = sum(1 / (k + rank))` onde k=60
- Retorna top 10 unificados

**3c. Re-Ranking com IA**: Enviar top 10 para Lovable AI (`gemini-2.5-flash-lite`) com instrucao de ranquear por relevancia. Retornar top 5.

**3d. Remover fallback de keywords** (substituido pelo hybrid search nativo).

### 4. Feedback Loop — Aprendizado Continuo

**4a. Registro automatico**: No `response-generator`, apos usar chunks RAG, registrar em `knowledge_search_feedback`:
- query, chunks retornados, empresa, lead_id
- outcome inferido: se proxima intent do lead for positiva (resposta, agradecimento) = `UTIL`, se escalar/repetir = `NAO_UTIL`

**4b. Nova edge function `knowledge-feedback-learner`** (CRON semanal):
- Analisar feedback das ultimas 7 dias
- Identificar queries com baixa eficacia (outcome `NAO_UTIL` >= 60%)
- Ajustar `boost` em metadata de chunks consistentemente uteis
- Gerar sugestoes de FAQ automaticamente para gaps com frequency >= 5 (inserir como `PENDENTE`)

### 5. Knowledge Gap Auto-Resolution

Expandir logica no `knowledge-feedback-learner`:
- Buscar gaps com `frequency >= 5` e `status = 'ABERTO'`
- Usar Lovable AI para gerar pergunta+resposta baseada no contexto existente
- Inserir como FAQ com `status = 'PENDENTE'`, `fonte = 'CONVERSA'` para revisao humana
- Marcar gap como `SUGERIDO`

### 6. UI — Dashboard de Feedback e Gaps

Atualizar `KnowledgeRAGStatus.tsx` e `KnowledgeGapsPanel.tsx`:
- Mostrar metricas de eficacia do RAG (% queries com resultado util)
- Mostrar FAQs auto-sugeridas pendentes de aprovacao
- Mostrar metodo de busca usado (semantic vs hybrid vs fallback)

---

## Arquivos a Criar/Editar

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Nova: fts, hybrid_search, feedback table, cache table |
| `knowledge-embed/index.ts` | Editar: semantic chunking + popular fts |
| `knowledge-search/index.ts` | Reescrever: expansion + hybrid + re-ranking |
| `knowledge-feedback-learner/index.ts` | **Novo**: CRON semanal |
| `sdr-ia-interpret/response-generator.ts` | Editar: registrar feedback |
| `src/components/knowledge/KnowledgeRAGStatus.tsx` | Editar: metricas de feedback |
| `src/hooks/useKnowledgeEmbeddings.ts` | Editar: stats de feedback |

### Prioridade
1. Migracao SQL (base para tudo)
2. Semantic Chunking (melhora qualidade dos embeddings)
3. Hybrid Search + Query Expansion (maior impacto imediato)
4. Re-Ranking (refinamento)
5. Feedback Loop + Auto-Resolution (aprendizado continuo)
6. UI updates

