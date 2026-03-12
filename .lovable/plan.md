

## Plano: Filtros Personalizados Condicionais (estilo Pipedrive)

### Conceito

Adicionar um sistema de filtros avançados com condições encadeáveis (AND/OR), permitindo ao usuário construir queries complexas como "Valor > 10.000 **E** Temperatura = Quente **E** Vendedor = João" ou "Valor > 50.000 **OU** Temperatura = Quente". Os filtros poderão ser salvos com nome para reutilização.

```text
┌─────────────────────────────────────────────────────────────┐
│ [⚙ Filtros avançados ▾]                                     │
├─────────────────────────────────────────────────────────────┤
│ Corresponder: (•) Todas as condições  ( ) Qualquer condição│
│                                                             │
│  [Valor      ▾] [maior que  ▾] [10000        ] [✕]        │
│  [Temperatura▾] [é igual a  ▾] [Quente       ] [✕]        │
│  [Vendedor   ▾] [é igual a  ▾] [João Silva   ] [✕]        │
│                                                             │
│  [+ Adicionar condição]                                     │
│                                                             │
│  Filtros salvos: [Meus quentes ▾] [💾 Salvar] [🗑 Excluir] │
│                                                             │
│              [Limpar]                    [Aplicar filtro]   │
└─────────────────────────────────────────────────────────────┘
```

### Campos filtráveis

| Campo | Operadores |
|---|---|
| Valor | é igual, maior que, menor que, entre |
| Temperatura | é igual a (FRIO/MORNO/QUENTE) |
| Vendedor | é igual a (lista de owners) |
| Etapa | é igual a (stages do pipeline) |
| Etiqueta | é igual a, contém |
| Data criação | antes de, depois de, entre |
| Data atualização | antes de, depois de, entre |
| Score probabilidade | maior que, menor que |
| Contato (nome) | contém |
| Origem | é igual a |

### Persistência dos filtros salvos

Criar tabela `pipeline_saved_filters` no banco:
- `id`, `user_id`, `pipeline_id`, `nome`, `match_mode` (all/any), `conditions` (JSONB array), `is_default`, `created_at`

Com RLS para que cada usuário veja apenas seus próprios filtros.

### Arquivos a criar/editar

**`src/components/pipeline/AdvancedFilters.tsx`** (novo) — componente principal com:
- Toggle "Todas as condições" / "Qualquer condição" (AND vs OR)
- Lista dinâmica de linhas de condição (campo + operador + valor)
- Botão adicionar/remover condição
- Select de filtros salvos + botões salvar/excluir
- Botões Limpar e Aplicar

**`src/components/pipeline/FilterConditionRow.tsx`** (novo) — uma linha individual de condição com 3 selects (campo, operador, valor) e botão remover.

**`src/components/pipeline/PipelineFilters.tsx`** — adicionar botão "Filtros avançados" que abre um Popover/Collapsible com o `AdvancedFilters`. Exibir badge com contagem de condições ativas.

**`src/hooks/deals/useDealQueries.ts`** — aceitar `advancedFilters` como parâmetro opcional. Quando presente, construir a query Supabase dinamicamente com `.or()` ou múltiplos `.eq/.gt/.lt/.contains` conforme o `match_mode`.

**`src/hooks/useSavedFilters.ts`** (novo) — CRUD de filtros salvos na tabela `pipeline_saved_filters`.

**`src/pages/PipelinePage.tsx`** — gerenciar estado dos filtros avançados e passar para `useDeals` e `PipelineFilters`.

### Detalhes técnicos

- Condições são representadas como `{ field: string; operator: string; value: string | number | string[] }[]`
- No modo AND: cada condição vira um `.eq()/.gt()/.lt()` encadeado
- No modo OR: condições agrupadas com `.or('valor.gt.10000,temperatura.eq.QUENTE')`
- Filtros simples existentes (temperatura, vendedor, tag) continuam funcionando — os avançados são complementares
- Quando filtro avançado está ativo, os selects simples ficam desabilitados para evitar conflito
- Badge no botão mostra quantas condições estão ativas

### Migração SQL

```sql
CREATE TABLE public.pipeline_saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  match_mode TEXT NOT NULL DEFAULT 'all' CHECK (match_mode IN ('all', 'any')),
  conditions JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own filters"
  ON public.pipeline_saved_filters FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

