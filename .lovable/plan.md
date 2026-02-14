

# Paginacao Real (3.5) -- Melhoria do Relatorio PO

## Resumo

O projeto possui **5 paginas com paginacao server-side** funcional (usando `.range()` + `count: 'exact'`), porem com UI duplicada e inconsistente (apenas botoes Anterior/Proxima, sem numeros de pagina). Alem disso, **3 paginas carregam TODOS os registros** sem nenhuma paginacao, o que pode causar lentidao e atingir o limite de 1000 rows do Supabase.

O componente `Pagination` do shadcn/ui ja existe em `src/components/ui/pagination.tsx` mas **nao e utilizado em nenhuma pagina**.

---

## Diagnostico: Estado Atual

| Pagina | Paginacao Server | UI | Problema |
|--------|-----------------|-----|----------|
| ContatosPage | `.range()` + count | Prev/Next manual | UI duplicada, sem numeros de pagina, page 0-based |
| OrganizationsPage | `.range()` + count | Prev/Next manual | UI duplicada, hardcoded `/ 25` |
| LeadsList | `.range()` + count | Prev/Next manual | UI duplicada, page 1-based |
| CadenceRunsList | `.range()` + count | Prev/Next manual | UI duplicada, page 1-based |
| MonitorSgtEvents | `.range()` + count | Prev/Next manual | UI duplicada, page 1-based |
| **CadencesList** | **Nenhuma** | Nenhuma | Carrega TODAS cadencias |
| **Atendimentos** | **Nenhuma** | Nenhuma | Carrega TODOS atendimentos |
| **TemplatesPage** | **Nenhuma** | Nenhuma | Carrega TODOS templates |

---

## Plano de Implementacao

### Fase 1: Criar componente reutilizavel `DataTablePagination`

Criar `src/components/ui/data-table-pagination.tsx` que encapsula toda a logica de paginacao:

- Utiliza os primitivos `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationEllipsis`, `PaginationPrevious`, `PaginationNext` ja existentes
- Props: `page` (0-based), `totalPages`, `totalCount`, `pageSize`, `onPageChange`
- Exibe: "Mostrando X-Y de Z registros" + botoes de pagina com ellipsis inteligente
- Logica de ellipsis: mostra primeira, ultima e 2 vizinhas da pagina atual

### Fase 2: Refatorar as 5 paginas que ja tem paginacao

Substituir o bloco duplicado de Prev/Next em cada pagina pelo novo componente:

1. **ContatosPage** -- Substituir bloco linhas 220-233 por `<DataTablePagination />`
2. **OrganizationsPage** -- Substituir bloco linhas 128-141; corrigir hardcoded `/ 25` para usar `ORG_PAGE_SIZE`
3. **LeadsList** -- Substituir bloco linhas 548-574; normalizar page para 0-based
4. **CadenceRunsList** -- Substituir bloco linhas 516-538; normalizar page para 0-based
5. **MonitorSgtEvents** -- Substituir bloco linhas 357-378; normalizar page para 0-based

### Fase 3: Adicionar paginacao server-side nas 3 paginas sem paginacao

#### 3a. TemplatesPage + useTemplates

- Adicionar `page` e `count: 'exact'` + `.range()` ao hook `useTemplates`
- Adicionar `<DataTablePagination />` na UI
- PAGE_SIZE = 25

#### 3b. CadencesList + useCadences

- O hook `useCadences()` ja retorna tudo sem paginacao; adicionar parametros `page`/`pageSize` com `.range()` e `count: 'exact'`
- Adicionar `<DataTablePagination />` na UI
- PAGE_SIZE = 25

#### 3c. Atendimentos + useAtendimentos

- Este hook faz logica complexa client-side (joins manuais entre 4 tabelas). A paginacao aqui sera **client-side** com slice, pois a logica de merge impede `.range()` direto
- Adicionar estado `page` e fatiar o array final com `.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)`
- Adicionar `<DataTablePagination />` na UI

---

## Detalhes do Componente DataTablePagination

```text
Props:
  page: number          -- pagina atual (0-based)
  totalPages: number    -- total de paginas
  totalCount: number    -- total de registros
  pageSize: number      -- registros por pagina
  onPageChange: (page: number) => void

Renderizacao:
  [Mostrando 1-25 de 342 registros]
  [< Anterior] [1] [2] [3] [...] [14] [Proxima >]

Logica de numeros visiveis:
  - Sempre mostra pagina 1 e ultima
  - Mostra 2 vizinhas da pagina atual
  - Ellipsis entre gaps > 1
  - Maximo ~7 botoes numericos visiveis
```

---

## Ordem de Execucao

```text
1. Criar DataTablePagination (componente reutilizavel)
2. Refatorar ContatosPage + OrganizationsPage (0-based, mais simples)
3. Refatorar LeadsList + CadenceRunsList + MonitorSgtEvents (normalizar indexacao)
4. Adicionar paginacao em TemplatesPage (hook simples)
5. Adicionar paginacao em CadencesList (hook simples)
6. Adicionar paginacao client-side em Atendimentos (slice)
```

## Impacto Esperado

- Componente de paginacao unificado com numeros de pagina e ellipsis
- 8 paginas com paginacao consistente (vs 5 atualmente com UI duplicada)
- Reducao de ~80 linhas de codigo duplicado
- Prevencao do limite de 1000 rows em TemplatesPage e CadencesList
- Melhor experiencia do usuario com indicador "Mostrando X-Y de Z"
- Zero mudanca de banco de dados

## Detalhes Tecnicos

- O componente usa os primitivos shadcn/ui ja existentes em `pagination.tsx`
- Nenhuma dependencia nova necessaria
- Hooks existentes que ja usam `.range()` mantem a mesma API
- Hooks novos (useTemplates, useCadences) recebem parametro `page` opcional para backwards compatibility
- Atendimentos usa paginacao client-side por limitacao arquitetural do hook (merge de 4 tabelas)

