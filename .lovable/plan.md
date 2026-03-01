

# Fix: Indexação de livros retornando zero chunks

## Problema identificado

Os logs mostram o erro `"\\u0000 cannot be converted to text."` (código PostgreSQL `22P05`). O extrator de PDF está gerando texto com caracteres nulos (`\0`) que o PostgreSQL rejeita na inserção. O embedding é gerado com sucesso pela OpenAI, mas o INSERT falha — resultando em 0 chunks indexados.

## Solução

### 1. Sanitizar texto extraído do PDF

Adicionar uma função `sanitizeText()` que remove `\u0000` e outros caracteres de controle problemáticos do texto extraído, aplicada em dois pontos:

- Na função `extractPdfTextFromBucket` — limpar o texto final antes de retornar
- Na função `embedChunks` — limpar cada `chunk_text` antes do INSERT como segunda camada de proteção

```typescript
function sanitizeText(text: string): string {
  return text.replace(/\u0000/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}
```

### 2. Melhorar extração de PDF

O extrator atual usa regex em streams PDF raw, que é muito limitado para livros complexos. Adicionar:

- Decodificação de streams FlateDecode (comprimidos com zlib) — a maioria dos PDFs modernos usa compressão
- Fallback para extração de texto via BT/ET operators além de Tj/TJ
- Limpeza de caracteres de escape PDF (`\n`, `\r`, octal escapes)

### 3. Logging de diagnóstico

Adicionar log do tamanho do texto extraído e número de chunks gerados para facilitar debug futuro.

## Detalhes Técnicos

- **Arquivo**: `supabase/functions/knowledge-embed/index.ts`
- **Funções afetadas**: `extractPdfTextFromBucket()`, `embedChunks()`, `sanitizeText()` (nova)
- **Impacto**: Apenas na edge function de embedding — sem alteração no response-generator nem no knowledge-search
- **Compatibilidade**: Nenhum impacto nas melhorias de desempenho da Amélia — são camadas diferentes

