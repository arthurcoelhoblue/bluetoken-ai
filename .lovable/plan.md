

# Plano: Filtrar Cadencias por Empresa Ativa

## Problema

O hook `useCadences` nao aplica o filtro de `activeCompanies` do contexto multi-tenant. Todas as outras telas (Contatos, CS, Pipeline, Gamificacao) usam `useCompany()` para obter as empresas selecionadas e filtram com `.in('empresa', activeCompanies)`.

## Solucao

Alterar `src/hooks/cadences/useCadences.ts` para:

1. Importar `useCompany` de `@/contexts/CompanyContext`
2. Obter `activeCompanies` via `useCompany()`
3. Adicionar `activeCompanies` na `queryKey`
4. Aplicar `.in('empresa', activeCompanies)` na query principal (antes dos filtros manuais)

Tambem aplicar o mesmo filtro no `useCadenciasCRMView` (em `useCadenceMutations.ts`), que alimenta os dados de "Deals Ativos" e "Deals Concluidos" na tabela.

## Arquivos alterados

- `src/hooks/cadences/useCadences.ts` -- adicionar filtro `activeCompanies` em `useCadences`
- `src/hooks/cadences/useCadenceMutations.ts` -- adicionar filtro `activeCompanies` em `useCadenciasCRMView`

## Comportamento esperado

- Se o usuario tem BLUE selecionada, ve apenas cadencias da Blue
- Se tem TOKENIZA, ve apenas da Tokeniza
- Se tem ambas, ve todas (comportamento atual)
- O switcher de empresa no header controla a visualizacao

