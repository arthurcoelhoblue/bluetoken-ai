

# Base de Conhecimento Comportamental — Amélia aprende com livros

## Conceito

Criar uma camada separada de conhecimento **comportamental/metodológico** onde o gestor faz upload de PDFs de livros de vendas (SPIN Selling, Challenger Sale, GPCT, etc.) e a Amélia absorve essas técnicas para moldar **como** ela vende — separado da base de produtos que define **o que** ela vende.

## Arquitetura

```text
┌─────────────────────────────────┐
│  Upload PDF (livro)             │
│  Admin → Metodologia de Vendas  │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  behavioral_knowledge (tabela)  │
│  título, autor, descrição,      │
│  storage_path, empresa, ativo   │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  knowledge-embed (edge fn)      │
│  action: "embed_behavioral"     │
│  source_type: "behavioral"      │
│  Semantic chunking do PDF       │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  knowledge_embeddings           │
│  source_type = "behavioral"     │
│  Chunks indexados via RAG       │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  response-generator.ts          │
│  Busca comportamental separada  │
│  → Injeta como "metodologia"    │
│  no system prompt               │
└─────────────────────────────────┘
```

## Plano de Implementação

### Passo 1 — Tabela `behavioral_knowledge`

Nova tabela para armazenar referências aos livros/materiais de metodologia:

- `id` (uuid PK)
- `empresa` (text, ex: TOKENIZA, BLUE)
- `titulo` (text — nome do livro)
- `autor` (text nullable)
- `descricao` (text nullable — breve resumo do que o livro ensina)
- `storage_path` (text — caminho no bucket)
- `nome_arquivo` (text)
- `ativo` (boolean default true)
- `created_at`, `updated_at`

Bucket de storage: reutilizar `knowledge-documents` ou criar `behavioral-books`.

### Passo 2 — Extensão do `knowledge-embed`

Adicionar nova action `embed_behavioral` que:
1. Busca o registro em `behavioral_knowledge`
2. Faz download do PDF do storage
3. Extrai texto (reutiliza `extractPdfText` existente)
4. Faz semantic chunking com prefix `[Metodologia: {titulo}]`
5. Grava em `knowledge_embeddings` com `source_type = "behavioral"`

Também incluir no `embed_all`/`reindex` para reindexar materiais comportamentais.

### Passo 3 — Busca comportamental no `response-generator`

No fluxo de geração de resposta da Amélia:
1. Fazer uma busca semântica separada filtrando `source_type = 'behavioral'` com a mensagem do lead
2. Recuperar 2-3 chunks de metodologia relevantes
3. Injetar no system prompt como seção `## METODOLOGIA DE VENDAS` — orientações de **como** conduzir a conversa, não como informação factual

Isso garante que a Amélia aplique técnicas do livro (ex: perguntas SPIN, abordagem Challenger) sem confundir com dados de produto.

### Passo 4 — UI de gestão

Nova aba ou seção em **Configuração → Base de Conhecimento** chamada "Metodologia de Vendas":
- Lista de livros/materiais enviados com status de indexação
- Upload de PDF com campos: título, autor, descrição
- Toggle ativo/inativo por material
- Botão "Reindexar" individual
- Indicador de quantos chunks foram gerados

## Detalhes Técnicos

- **Extração de PDF**: O extrator atual (`extractPdfText`) é básico (regex em streams PDF). Para livros complexos, pode precisar de melhoria futura, mas funciona para PDFs com texto embarcado.
- **Separação semântica**: Chunks comportamentais recebem `source_type = "behavioral"` para nunca serem confundidos com dados de produto no RAG de produtos.
- **Prompt injection**: A seção de metodologia é injetada como **diretriz comportamental**, não como fato — a Amélia usa as técnicas mas não cita o livro ao lead.

