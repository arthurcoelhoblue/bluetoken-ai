

# O que o ChatBlue tem na Base de Conhecimento

## Estrutura de Dados (Prisma Schema)

O ChatBlue tem **3 camadas** de conhecimento:

### 1. Knowledge Base (simples) — `knowledge_base`
- `title`, `content` (texto livre), `category`, `tags[]`, `order`
- `isActive`, `departmentId` (filtro por departamento)
- CRUD simples com busca por título/conteúdo/tags

### 2. FAQ — `faqs`
- `question`, `answer`, `keywords[]`, `category`, `order`
- `useCount` (contagem de uso — nós não temos isso)
- `departmentId`, `isActive`
- Sync automático com IA via `knowledge-sync.service`

### 3. Knowledge Contexts (RAG System) — 3 tabelas
- **`knowledge_contexts`**: agrupador com `name`, `description`, `slug`, `systemPrompt`, `keywords[]`, `priority`
- **`knowledge_sources`**: fontes dentro de um contexto — suporta 7 tipos: `TEXT`, `PDF`, `NOTION`, `URL`, `DOCX`, `CSV`, `JSON`
- **`knowledge_chunks`**: pedaços indexados com `content`, `embedding` (JSON string de floats), `metadata`

## Serviços de IA (Backend)

### Ingestion Service (`ingestion.service.ts`)
Processa cada tipo de fonte:
- TEXT: lê conteúdo direto ou de arquivo
- PDF: usa `pdf-parse` para extrair texto
- NOTION: usa API oficial para ler páginas
- DOCX: usa `mammoth` para extrair texto
- CSV: formata linhas com cabeçalho
- JSON: stringify formatado
- URL: não implementado (TODO)
- **Chunking**: `chunkContent(content, chunkSize=1000, chunkOverlap=200)` — divide texto em pedaços

### Embedding Service (`embedding.service.ts`)
- Usa `text-embedding-3-small` da OpenAI (1536 dims)
- Suporta batch de embeddings
- Inclui `cosineSimilarity()` para busca

### Context Retrieval (`context-retrieval.service.ts`)
- **Detecção por keywords**: score baseado em palavras-chave do contexto
- **Busca semântica**: gera embedding da query → calcula coseno vs chunks → retorna top N
- **Fallback por keywords**: se não tem embeddings, busca por palavras-chave no texto dos chunks
- **Fallback total**: se nada funciona, retorna todo o conteúdo das fontes

## O que nós já temos vs o que falta

| Feature | ChatBlue | Amélia (nosso) |
|---------|----------|----------------|
| Knowledge Base simples | ✅ title/content/category | ✅ product_knowledge + knowledge_sections |
| FAQ | ✅ com useCount | ✅ knowledge_faq (sem useCount) |
| Contextos RAG | ✅ knowledge_contexts | ❌ Não temos agrupador de contextos |
| Fontes múltiplas | ✅ TEXT/PDF/NOTION/URL/DOCX/CSV/JSON | ❌ Só texto manual + PDF decorativo |
| Chunking | ✅ 1000 chars / 200 overlap | ✅ 500 tokens / 50 overlap |
| Embeddings | ✅ text-embedding-3-small | ✅ text-embedding-3-small |
| Busca semântica | ✅ coseno no app server | ✅ pgvector no banco |
| Fallback keyword | ✅ | ❌ |
| useCount no FAQ | ✅ | ❌ |
| Sync Notion | ✅ | ❌ |
| Processamento PDF | ✅ pdf-parse | ❌ PDFs no storage mas não indexados |
| Knowledge Gaps | ✅ ai_knowledge_gaps | ❌ |
| AI Agent Configs | ✅ múltiplos agentes com fontes diferentes | ❌ Amélia é agente único |

## Plano: Trazer o que falta do ChatBlue para a Amélia

### Fase 1 — Indexação de PDFs (maior gap)
- Atualizar `knowledge-embed` para processar documentos da tabela `knowledge_documents`
- Extrair texto dos PDFs do storage, chunkar e gerar embeddings
- Os PDFs já estão uploadados, só faltam ser indexados

### Fase 2 — useCount no FAQ
- Adicionar coluna `use_count` na tabela `knowledge_faq`
- Incrementar quando a Amélia usa uma FAQ para responder
- Mostrar no admin quais FAQs são mais úteis

### Fase 3 — Knowledge Gaps (detecção de lacunas)
- Nova tabela `knowledge_gaps`: `topic`, `description`, `frequency`, `sample_queries[]`, `status`
- Quando a Amélia não encontra chunks relevantes (similarity < threshold), registrar o gap
- Dashboard no admin mostrando "O que a Amélia não sabe responder"

### Fase 4 — Fallback por keywords
- Se a busca semântica retorna 0 resultados, fazer busca por palavras-chave no texto das seções
- Garante que sempre há algum contexto, mesmo sem embeddings

### Alterações Técnicas

1. **Migration SQL**: adicionar `use_count` em `knowledge_faq`, criar tabela `knowledge_gaps`
2. **`knowledge-embed`**: adicionar action `embed_document` que baixa PDF do storage, extrai texto e gera embeddings
3. **`knowledge-search`**: adicionar fallback por keywords quando similarity < threshold
4. **`sdr-ia-interpret`**: registrar knowledge gaps quando não encontra contexto relevante, incrementar `use_count` nas FAQs usadas
5. **Frontend**: componente `KnowledgeGaps` no dashboard admin, contador de uso nas FAQs

