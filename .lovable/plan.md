
Diagnóstico (com dados reais):
- O último lead criado foi **fe954a89-8c2f-4a47-964a-a891660ceab6** (14:52) e ele **tem** atividade `CRIACAO` com `origem=FORMULARIO` + `campos_preenchidos`.
- Porém existem **47 deals** com `metadata.campos_extras` e **sem** atividade `CRIACAO/FORMULARIO` (legado), incluindo exemplos recentes em BLUE_LABS.
- Resultado prático: ao abrir um deal “parecido” (duplicados com mesmo título/canal), parece que “não chegou” porque naquele deal específico a atividade não foi criada historicamente.

Solução proposta (definitiva, sem regressão):

1) Backfill histórico de timeline (banco)
- Criar migração idempotente que insere `deal_activities` tipo `CRIACAO` para deals que:
  - têm `deals.metadata.campos_extras`,
  - não têm `CRIACAO` com `metadata.origem='FORMULARIO'`.
- Montar `metadata` no mesmo formato atual (`origem`, `canal_origem`, `form_id`, `campos_preenchidos`, UTM).
- Usar `NOT EXISTS` para não duplicar em reexecuções.

2) Hardening da ingestão (lp-lead-ingest)
- No insert de `deal_activities`, capturar `error` explicitamente.
- Se falhar: log estruturado + retorno no `results` (ex.: `activity_status: failed`) para observabilidade.
- Mantém criação de contato/deal, mas não “silencia” falha da timeline.

3) Fallback no frontend da Timeline
- Em `DealTimelineTab`, se não houver atividade `CRIACAO/FORMULARIO`, renderizar bloco “Dados do formulário” a partir de `deal.metadata.campos_extras`.
- Isso cobre legado e qualquer falha pontual futura sem depender só da activity.

4) Evitar abrir o deal errado entre duplicados
- Em `useDeals` (kanban), manter `order(posicao_kanban)` e adicionar desempate por `created_at desc`.
- Em `DealCard`, exibir selo curto de entrada (ex.: “Entrou 14:52”) para distinguir duplicados iguais.

Arquivos/partes impactadas:
- Migração SQL (backfill em `deal_activities`).
- `supabase/functions/lp-lead-ingest/index.ts` (tratamento de erro de activity).
- `src/components/deals/DealTimelineTab.tsx` (fallback de `deal.metadata.campos_extras`).
- `src/hooks/deals/useDealQueries.ts` e `src/components/pipeline/DealCard.tsx` (desempate + indicação visual de recência).

Critério de aceite:
- Abrir 3 casos: (a) lead novo, (b) lead legado sem activity, (c) duplicado com mesmo título.
- Nos 3, a Timeline deve mostrar dados do formulário (via activity ou fallback), e o usuário deve identificar facilmente o deal mais recente.
