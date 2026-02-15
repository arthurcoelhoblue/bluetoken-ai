

# Fase 2 da Auditoria - Qualidade de Codigo

Proximos itens do plano: 2.1 (eliminar `any`), 2.2 (quebrar hooks), 2.4 (quebrar componentes), 4.1 (README), 4.2 (versionamento).

Vou agrupar o que cabe nesta sessao sem quebrar nenhuma importacao existente.

---

## Item 2.1 - Eliminar `any` nos hooks criticos

Substituir `as any` e `: any` por tipos corretos nos hooks que tocam o banco. Todos os casts de `as any` em `.from()`, `.insert()`, `.update()` e callbacks de `.map()` serao tipados corretamente.

**Arquivos afetados (11 hooks):**

| Arquivo | Qtd `any` | Correcao |
|---------|-----------|----------|
| `useContactsPage.ts` | 6 | Remover `as any` dos `.from()`, `.insert()`, `.update()` -- usar cast generico no retorno |
| `useCSCustomers.ts` | 3 | Tipar insert/update payload com interface dedicada |
| `useAutoRules.ts` | 5 | Tipar `pipeline_auto_rules` e callbacks |
| `useCaptureForms.ts` | 4 | Tipar `onError` como `Error` e callback de `.map()` |
| `useImportacao.ts` | 5 | Tipar `errorLog`, `insertData`, e `catch (e)` |
| `useNotifications.ts` | 2 | Remover `as any` do `.update()` |
| `usePipelines.ts` | 1 | Tipar callback `.map()` |
| `usePipelineConfig.ts` | 5 | Tipar acessos a `pipeline_stages` |
| `useAccessControl.ts` | 3 | Tipar callbacks de `.map()` |
| `useCopilotMessages.ts` | 4 | Tipar `.filter()` e `.map()` callbacks, empresa cast |
| `useOrphanDeals.ts` | 1 | Tipar callback `.map()` |

**Estrategia:** Para tabelas/views que nao existem nos tipos gerados (ex: `contacts_with_stats`, `pipeline_auto_rules`), manter o cast `as any` APENAS no `.from()` (inevitavel pois o tipo gerado nao conhece a view) mas tipar o retorno com `as unknown as TipoCorreto`. Para callbacks `.map((x: any) => ...)`, substituir `any` pelo tipo inferido do Supabase ou por uma interface local.

---

## Item 2.2 - Quebrar `useDeals.ts`

O hook `useDeals.ts` (289 linhas) exporta 10 funcoes/hooks misturando queries, mutations e loss categories. Vou dividir em 2 arquivos mantendo re-exports no arquivo original para nao quebrar nenhum import existente.

**Nova estrutura:**

| Arquivo | Conteudo |
|---------|----------|
| `src/hooks/deals/useDealQueries.ts` | `useDeals`, `useKanbanData` |
| `src/hooks/deals/useDealMutations.ts` | `useCreateDeal`, `useUpdateDeal`, `useMoveDeal`, `useDeleteDeal`, `useCloseDeal`, `useLossCategories`, CRUD de loss categories |
| `src/hooks/useDeals.ts` | Re-exporta tudo de `deals/useDealQueries` e `deals/useDealMutations` (zero quebra) |

**Impacto:** ZERO. Todos os 8 arquivos que importam de `@/hooks/useDeals` continuam funcionando porque o barrel file re-exporta tudo.

---

## Item 2.4 - Quebrar `DealDetailSheet.tsx`

O componente (484 linhas) sera dividido extraindo as tabs em subcomponentes:

| Arquivo | Conteudo |
|---------|----------|
| `src/components/deals/DealDetailHeader.tsx` | Header com titulo, status, badges, botoes de acao (fechar, reabrir, editar) |
| `src/components/deals/DealDetailOverviewTab.tsx` | Tab "Visao Geral" com campos editaveis, contato, owner, valor |
| `src/components/deals/DealDetailActivitiesTab.tsx` | Tab "Atividades" com timeline e formulario de nova atividade |
| `src/components/deals/DealDetailSheet.tsx` | Orquestra as tabs, passa props para os subcomponentes |

---

## Item 4.1 + 4.2 - README + Versionamento

**README.md:** Reescrever com descricao real do projeto, arquitetura (frontend React + backend functions + banco), variaveis de ambiente, como rodar localmente.

**package.json:** Atualizar versao de `0.0.0` para `1.0.0`.

---

## Sequencia de execucao

1. Criar pasta `src/hooks/deals/` e mover logica do `useDeals.ts` (2.2)
2. Extrair subcomponentes do `DealDetailSheet.tsx` (2.4)
3. Eliminar `any` nos 11 hooks (2.1)
4. Reescrever README.md e atualizar versao (4.1 + 4.2)
5. Atualizar `.lovable/plan.md` marcando itens concluidos

---

## Detalhes tecnicos

### Re-export pattern para useDeals.ts
```typescript
// src/hooks/useDeals.ts (barrel file)
export { useDeals, useKanbanData } from './deals/useDealQueries';
export { useCreateDeal, useUpdateDeal, useMoveDeal, useDeleteDeal, useCloseDeal, useLossCategories, useCreateLossCategory, useUpdateLossCategory, useDeleteLossCategory, useReorderLossCategories } from './deals/useDealMutations';
export type { CloseDealData } from './deals/useDealMutations';
```

### Tipagem para `any` em callbacks
Onde o Supabase retorna `data` sem tipo inferido (views, tabelas nao tipadas), o pattern sera:
```typescript
// ANTES
.map((r: any) => ({ ...r, from_stage_nome: r.from_stage?.nome }))

// DEPOIS  
.map((r) => {
  const row = r as { id: string; from_stage?: { nome: string }; ... };
  return { ...row, from_stage_nome: row.from_stage?.nome ?? null };
})
```

### DealDetailSheet - props interface
Cada subcomponente recebera props tipadas com os dados que precisa, evitando prop drilling excessivo. O `DealDetailSheet` continuara sendo o unico a fazer os `useQuery` calls e passara dados via props.

