

# Fix: Sanitizar nome do arquivo no upload de livros comportamentais

## Problema
O Storage rejeita keys com caracteres especiais (acentos, cedilha, etc.). O código em `useBehavioralKnowledge.ts` usa `file.name` diretamente no `filePath`, gerando paths como `BLUE/123-As armas da persuasão.pdf` que retornam `400 InvalidKey`.

O mesmo problema pode afetar `useProductKnowledge.ts` (upload de documentos de produto).

## Correção

### 1. `src/hooks/useBehavioralKnowledge.ts`
Adicionar função de sanitização que remove acentos e caracteres especiais do nome do arquivo antes de montar o path de upload:

```typescript
function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_'); // substitui outros chars por _
}
```

Usar no `filePath`: `${empresa}/${Date.now()}-${sanitizeFileName(file.name)}`

Manter `file.name` original no campo `nome_arquivo` do banco (para exibição).

### 2. `src/hooks/useProductKnowledge.ts`
Aplicar a mesma sanitização no `useUploadKnowledgeDocument` que também usa `file.name` no path do Storage.

## Arquivos
| Arquivo | Ação |
|---|---|
| `src/hooks/useBehavioralKnowledge.ts` | Sanitizar `file.name` no path de upload |
| `src/hooks/useProductKnowledge.ts` | Mesma sanitização no upload de documentos |

