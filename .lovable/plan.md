

## Diagnóstico

O problema **não é o botão** em si — os botões de "Ensinar" existem no código e funcionam. O problema é que **nenhuma lacuna aparece na lista** porque:

1. Todas as 11 lacunas no banco estão com `empresa = 'TOKENIZA'`
2. A empresa ativa selecionada no seu painel é "Blue Consult" (que mapeia para `BLUE`)
3. O componente filtra `WHERE empresa = 'BLUE'` e não encontra nada → mostra "Nenhuma lacuna detectada"

## Solução

Duas correções:

### 1. Remover filtro de empresa na aba Lacunas (ou usar multi-empresa)
Na `ProductKnowledgeList.tsx`, passar `activeCompanies` em vez de apenas `activeCompany` para o componente `KnowledgeGaps`, permitindo ver lacunas de todas as empresas do usuário.

### 2. Atualizar `KnowledgeGaps.tsx` para aceitar múltiplas empresas
- Alterar a prop de `empresa: string` para `empresas: string[]`
- Usar `.in("empresa", empresas)` na query ao invés de `.eq("empresa", empresa)`
- Mostrar um badge com a empresa de cada lacuna para contexto

| Arquivo | Mudança |
|---|---|
| `src/pages/admin/ProductKnowledgeList.tsx` | Passar `activeCompanies` para `KnowledgeGaps` |
| `src/components/knowledge/KnowledgeGaps.tsx` | Aceitar array de empresas e filtrar com `.in()` |

