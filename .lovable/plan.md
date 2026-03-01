

# Diagnóstico: Indexação de livros falhando — causa raiz encontrada

## Problema

O erro **não é** de caracteres nulos nem de extração de PDF. O erro real é:

```
code: "23514"
message: 'new row for relation "knowledge_embeddings" violates check constraint "knowledge_embeddings_source_type_check"'
```

A tabela `knowledge_embeddings` tem um CHECK constraint que só aceita três valores:

```sql
CHECK (source_type = ANY (ARRAY['section', 'faq', 'document']))
```

O valor `'behavioral'` não está na lista. Todos os inserts falham por isso.

## Solução

Uma migration para atualizar o CHECK constraint:

```sql
ALTER TABLE public.knowledge_embeddings 
  DROP CONSTRAINT knowledge_embeddings_source_type_check;

ALTER TABLE public.knowledge_embeddings 
  ADD CONSTRAINT knowledge_embeddings_source_type_check 
  CHECK (source_type = ANY (ARRAY['section', 'faq', 'document', 'behavioral']));
```

Após isso, basta reindexar o livro na aba Metodologia de Vendas — os chunks serão inseridos normalmente.

