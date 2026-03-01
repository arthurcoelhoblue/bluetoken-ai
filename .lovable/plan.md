

# Tornar Metodologias de Vendas Globais (Cross-Empresa)

## Problema
Atualmente, os livros de metodologia (`behavioral_knowledge`) são filtrados por `empresa` em todos os pontos: UI, indexação (embeddings), e busca RAG. Isso significa que um livro enviado pela BLUE não é visível nem utilizado pela Amélia quando opera pela TOKENIZA, MPUPPE ou AXIA.

## Pontos de Alteração

### 1. UI — Listar todos os livros (sem filtro de empresa)
**`src/hooks/useBehavioralKnowledge.ts`**: Remover o filtro `.eq('empresa', activeCompany)` na query de listagem. Manter `empresa` no upload apenas para rastreio de quem enviou.

### 2. Busca RAG — Ignorar filtro de empresa para behavioral
**`supabase/functions/knowledge-search/index.ts`**: Quando `source_type_filter === 'behavioral'`, fazer uma busca separada sem o filtro `p_empresa`, ou modificar as RPCs para aceitar um parâmetro `p_ignore_empresa_for_types`.

A abordagem mais simples: **duas buscas**. A busca principal (com empresa) já filtra corretamente para FAQs/documentos. Para behavioral, a chamada no `response-generator.ts` já passa `source_type_filter: 'behavioral'` — basta que o `knowledge-search` não aplique o filtro de empresa quando esse filtro de tipo está presente.

### 3. RPCs de busca — Permitir busca cross-empresa
**Migration SQL**: Atualizar `hybrid_search_knowledge` e `search_knowledge_embeddings` para aceitar um parâmetro opcional `p_cross_empresa BOOLEAN DEFAULT false`. Quando `true`, remove o `WHERE ke.empresa = p_empresa` para tipo behavioral.

Alternativa mais limpa: adicionar `p_source_type_filter TEXT DEFAULT NULL` às RPCs e, quando `source_type = 'behavioral'`, ignorar o filtro de empresa.

### 4. Indexação — Sem mudança necessária
O campo `empresa` na indexação serve apenas para rastreio. Não precisa mudar.

## Detalhes Técnicos

### Migration (RPCs atualizadas)
```sql
-- hybrid_search_knowledge: alterar WHERE para:
WHERE (p_source_type_filter IS NULL OR ke.source_type = p_source_type_filter)
  AND (ke.source_type = 'behavioral' OR ke.empresa = p_empresa)
  AND ke.embedding IS NOT NULL
  ...

-- search_knowledge_embeddings: mesma lógica
WHERE (ke.source_type = 'behavioral' OR ke.empresa = p_empresa)
  ...
```

### knowledge-search/index.ts
Passar `source_type_filter` para as RPCs como novo parâmetro, para que a filtragem cross-empresa aconteça no SQL.

### response-generator.ts
Nenhuma mudança — já passa `source_type_filter: 'behavioral'`.

### useBehavioralKnowledge.ts
Remover filtro de empresa na listagem. No upload, continuar salvando a empresa do usuário logado (para auditoria).

