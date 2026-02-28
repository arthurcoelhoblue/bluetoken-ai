

# RAG para a Base de Conhecimento — Onde se aplica

## Problema Atual

Hoje a Amelia carrega **TODO** o conhecimento no prompt a cada mensagem:
- 31 seções (~22k caracteres) concatenadas em texto bruto
- Sem relevância: se o lead pergunta sobre "rentabilidade do CRA", ela recebe também objeções de IR cripto, pitch de Blue, estrutura jurídica, etc.
- Quanto mais conteúdo cadastrar, mais tokens gasta e mais lenta fica
- Documentos uploaded (PDFs) não são usados — estão no storage mas nunca são lidos pela IA

## Onde RAG se aplica (3 pontos)

### 1. SDR IA — Busca semântica de conhecimento relevante
**Maior impacto.** Em vez de injetar 22k chars no prompt, buscar apenas os 3-5 trechos mais relevantes para a pergunta do lead.

- Lead pergunta "qual a rentabilidade do CRA?" → busca retorna apenas seções sobre CRA, rentabilidade, riscos associados
- Lead pergunta "quanto custa o IR cripto?" → retorna apenas pricing da Blue e FAQ de preços
- Reduz tokens em ~70%, melhora precisão, elimina ruído

### 2. FAQ — Auto-resposta com busca semântica
Em vez de match exato pergunta-pergunta, buscar a FAQ mais similar semanticamente.
- "Quanto rende?" → match com "Qual a rentabilidade esperada dos investimentos?"
- Permite resposta instantânea sem chamar IA quando confiança > 0.9

### 3. Documentos (PDFs) — Indexação e consulta
Os PDFs uploaded hoje são decorativos. Com RAG:
- Upload de PDF → extrai texto → chunka → gera embeddings → armazena
- Amelia consulta documentos quando não encontra resposta nas seções manuais

## Alterações Técnicas

### Banco de dados
- Habilitar extensão `vector` (pgvector)
- Nova tabela `knowledge_embeddings`:
  - `id`, `source_type` (section/faq/document), `source_id`, `chunk_text`, `embedding vector(1536)`, `metadata jsonb`
- Índice `ivfflat` ou `hnsw` para busca rápida

### Edge Function: `knowledge-embed` (nova)
- Trigger: quando seção/FAQ é criada/atualizada
- Chunka o texto (500 tokens por chunk com overlap de 50)
- Gera embedding via Lovable AI (modelo embedding)
- Salva em `knowledge_embeddings`

### Edge Function: `knowledge-search` (nova)
- Input: query text + empresa + top_k
- Gera embedding da query
- Busca por similaridade coseno no pgvector
- Retorna top_k chunks mais relevantes

### Modificar `sdr-ia-interpret`
- `intent-classifier.ts`: substituir `fetchProductKnowledge()` (que carrega tudo) por chamada a `knowledge-search` com a mensagem do lead como query
- `response-generator.ts`: injetar apenas os chunks relevantes no prompt em vez de todos os produtos

### Modificar `copilot-chat`
- Usar `knowledge-search` para enriquecer contexto do Copilot com conhecimento relevante

### Frontend: indicador de indexação
- Na página de Base de Conhecimento, mostrar status de indexação (embeddings gerados vs pendentes)
- Botão "Reindexar" para forçar re-embedding

## Fluxo Resultante

```text
Admin cadastra seção "Rentabilidade CRA Agro"
    → knowledge-embed gera chunks + embeddings
    → Salva em knowledge_embeddings

Lead pergunta: "Quanto rende o CRA?"
    → knowledge-search("Quanto rende o CRA?", empresa=TOKENIZA, top_k=5)
    → Retorna: chunk sobre rentabilidade CRA, chunk sobre riscos CRA
    → Prompt da Amelia recebe APENAS esses 2 chunks (~800 tokens vs 22k)
    → Resposta precisa e rápida
```

## Impacto
- **Tokens por mensagem**: ~22k → ~2-3k (economia de ~85%)
- **Precisão**: respostas baseadas apenas em conteúdo relevante
- **Escalabilidade**: pode cadastrar 100 produtos sem degradar performance
- **Documentos**: PDFs passam a ser consultáveis pela IA

