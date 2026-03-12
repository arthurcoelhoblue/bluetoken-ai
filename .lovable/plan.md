

## Plano: Enriquecer a Timeline do Deal

### Diagnóstico atual
A timeline renderiza todas as atividades de forma genérica — mesma apresentação para STAGE_CHANGE, VALOR_CHANGE, GANHO, PERDA, etc. Os dados ricos já existem no `metadata` (stage IDs, valores antigos/novos, motivo de perda) mas não são exibidos. A tabela `deal_stage_history` (tempo no estágio, auto_advanced) também não é consultada.

### O que será implementado

**1. Renderização rica por tipo de atividade**
- **STAGE_CHANGE**: Buscar nomes dos estágios (from/to) via stages do pipeline e exibir como `"Qualificação" → "Proposta"` com cores dos estágios. Se `auto_advanced`, badge "⚡ Auto".
- **VALOR_CHANGE**: Exibir `R$ 5.000 → R$ 12.000` com seta e formatação monetária.
- **GANHO**: Badge verde com valor total do deal.
- **PERDA**: Badge vermelha com motivo e categoria de perda.
- **CADENCIA**: Nome da cadência e step, se disponível no metadata.
- **CALL**: Direção (entrada/saída), duração formatada, link para gravação.
- **WHATSAPP**: Renderizar preview da mensagem se disponível.

**2. Tempo no estágio na timeline**
- Consultar `deal_stage_history` para o deal e mesclar com as atividades existentes de STAGE_CHANGE.
- Exibir badge `"⏱ 3d 5h no estágio anterior"` nas movimentações.

**3. Filtro de atividades**
- Chips no topo da timeline para filtrar por categoria: Todos, Notas, Comunicação (LIGACAO+EMAIL+WHATSAPP+CALL), Movimentação (STAGE_CHANGE+GANHO+PERDA+REABERTO), Sistema (CADENCIA+CRIACAO+VALOR_CHANGE).

**4. Visual aprimorado**
- Linha vertical conectora entre eventos (timeline visual).
- Avatares dos usuários quando disponíveis.
- Agrupamento visual por data (separadores "Hoje", "Ontem", "15/03/2026").

### Arquivos a criar/editar

**`src/components/deals/DealTimelineTab.tsx`** — refatorar a renderização para usar um componente `TimelineItem` com renderização condicional por tipo. Adicionar filtros e visual de linha conectora.

**`src/components/deals/TimelineItem.tsx`** (novo) — componente que recebe uma `DealActivity` + mapa de stages e renderiza a versão rica conforme o tipo.

**`src/hooks/useDealDetail.ts`** — adicionar `useDealStageHistory(dealId)` para buscar dados de `deal_stage_history` com nomes dos estágios.

### Detalhes técnicos

- Stages já estão disponíveis via `useDealPipelineStages` no `DealDetailSheet`, basta passar como prop.
- `deal_stage_history` será consultada com join nas `pipeline_stages` para trazer nomes: `from_stage:pipeline_stages!deal_stage_history_from_stage_id_fkey(nome, cor)` e `to_stage:pipeline_stages!deal_stage_history_to_stage_id_fkey(nome, cor)`.
- O `tempo_no_stage_anterior_ms` será formatado em dias/horas.
- Filtros são client-side sobre o array de activities já carregado.

