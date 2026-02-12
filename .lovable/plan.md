

# Controle de Nascimento e Morte de Deals no Funil

## Problema Atual
Hoje o sistema usa stages dedicados marcados como "Won" ou "Lost" (`is_won`/`is_lost`). Isso limita a visibilidade de **onde** o deal nasceu e **onde** ele foi perdido/ganho. O gestor tambem nao consegue definir um tempo minimo obrigatorio por etapa.

## Solucao Proposta

### Conceito
- Todo deal tera registro de **stage de origem** (onde foi criado) e **stage de fechamento** (onde foi ganho/perdido)
- Qualquer etapa pode ganhar ou perder um deal, desde que o tempo minimo configurado para aquela etapa tenha sido cumprido
- Um novo campo `tempo_minimo_minutos` sera adicionado a cada stage para o gestor configurar

### Mudancas no Banco de Dados (Migracao)

**Tabela `deals`** -- 2 novas colunas + 1 campo de status:
- `stage_origem_id` (UUID, FK para pipeline_stages) -- registra onde o deal nasceu
- `stage_fechamento_id` (UUID, FK para pipeline_stages) -- registra onde foi ganho/perdido
- `status` (TEXT, default 'ABERTO') -- valores: ABERTO, GANHO, PERDIDO

**Tabela `pipeline_stages`** -- 1 nova coluna:
- `tempo_minimo_minutos` (INTEGER, nullable) -- tempo minimo que o deal deve permanecer no stage antes de poder ser ganho/perdido

### Mudancas na Configuracao de Funis (`PipelineConfigPage`)

- Remover os botoes "Marcar como Won" / "Marcar como Lost" dos stages (ja que qualquer stage pode fechar um deal)
- Adicionar campo editavel de **Tempo Minimo (minutos)** em cada stage
- Manter o campo SLA existente (SLA e diferente: e o tempo maximo recomendado)

### Mudancas no Kanban (`KanbanBoard` / `DealCard`)

- Adicionar botoes de acao "Ganhar" e "Perder" em cada deal card (icones de Trophy e XCircle)
- Ao clicar em "Ganhar":
  - Verificar se o deal ja cumpriu o `tempo_minimo_minutos` do stage atual
  - Se nao cumpriu, exibir toast de erro com o tempo restante
  - Se cumpriu, marcar deal como GANHO, preencher `stage_fechamento_id`, `data_ganho`, `fechado_em`
- Ao clicar em "Perder":
  - Mesma validacao de tempo minimo
  - Abrir dialog pedindo `motivo_perda` (obrigatorio)
  - Marcar deal como PERDIDO, preencher `stage_fechamento_id`, `data_perda`, `fechado_em`, `motivo_perda`
- Deals com status GANHO ou PERDIDO ficam visualmente distintos (opacidade reduzida ou badge de status)
- Filtro opcional para ocultar deals fechados do board

### Mudancas no Hook `useDeals`

- Novo mutation `useCloseDeal` que recebe `{ dealId, status: 'GANHO' | 'PERDIDO', motivo_perda? }`
- Validacao client-side do tempo minimo antes de chamar a API
- `useCreateDeal` passa a gravar `stage_origem_id` automaticamente (igual ao `stage_id` inicial)

### Mudancas nos Tipos (`types/deal.ts`)

- Adicionar `stage_origem_id`, `stage_fechamento_id`, `status` ao tipo `Deal`
- Adicionar `tempo_minimo_minutos` ao tipo `PipelineStage`

## Detalhes Tecnicos

### Arquivos Alterados

1. **Migracao SQL** -- Adicionar colunas nas tabelas `deals` e `pipeline_stages`
2. **`src/types/deal.ts`** -- Novos campos nos tipos
3. **`src/hooks/useDeals.ts`** -- Novo mutation `useCloseDeal`, update no `useCreateDeal` para gravar `stage_origem_id`
4. **`src/components/pipeline/DealCard.tsx`** -- Botoes de Ganhar/Perder com validacao de tempo, dialog de motivo de perda
5. **`src/pages/PipelineConfigPage.tsx`** -- Remover toggles Won/Lost, adicionar input de tempo minimo por stage
6. **`src/hooks/usePipelineConfig.ts`** -- Atualizar `useCreateStage` e `useUpdateStage` para suportar `tempo_minimo_minutos`

### Validacao de Tempo Minimo

```text
tempo_no_stage = agora - ultima_entrada_no_stage (via deal_stage_history)
se tempo_no_stage < stage.tempo_minimo_minutos:
  bloquear acao + toast("Faltam X minutos para poder fechar este deal neste stage")
```

### Sobre os stages is_won / is_lost existentes
Os campos `is_won` e `is_lost` na tabela `pipeline_stages` serao mantidos no banco por retrocompatibilidade, mas nao serao mais usados na UI. O fechamento de deals passa a ser uma acao direta no card, independente do stage.

