

# Conversas — Filtros Inteligentes + Modo Kanban

## Resumo

Duas melhorias na aba Conversas: (1) filtros inteligentes com ordenação por prioridade IA, e (2) modo Kanban read-only agrupando conversas por etapa do deal vinculado. Toggle lista/kanban no header.

## 1. Enriquecer dados no `useAtendimentos`

O hook já busca deals (para ownership), mas não traz `stage_id`, `temperatura`, `score_*`. Precisa:

- Expandir a query de deals para incluir `stage_id, temperatura, score_engajamento, score_intencao, score_urgencia`
- Trazer `pipeline_stages.nome` e `pipeline_stages.cor` via join
- Buscar `modo` e `last_inbound_at` da `lead_conversation_state` (já busca `assumido_por`, falta esses dois)
- Adicionar esses campos na interface `Atendimento`:

```typescript
// Novos campos
modo: string | null;
temperatura: string | null;
deal_stage_nome: string | null;
deal_stage_cor: string | null;
deal_stage_id: string | null;
deal_id: string | null;
score_engajamento: number | null;
score_intencao: number | null;
score_urgencia: number | null;
last_inbound_at: string | null;
```

## 2. Filtros Inteligentes (modo lista)

Substituir o Select atual por chips/toggles de filtro rápido:

| Filtro | Lógica |
|---|---|
| Aguardando resposta | `modo = MANUAL` + `ultima_direcao = INBOUND` |
| SLA estourado | `last_inbound_at` > 2h atrás (sem resposta outbound depois) |
| Esfriando 🔥→❄️ | `temperatura IN (QUENTE, MORNO)` + `ultimo_contato` > 24h |
| Intenção de compra | `ultimo_intent IN (INTERESSE_COMPRA, AGENDAMENTO_REUNIAO)` |
| Não lidas | `ultima_direcao = INBOUND` (lead esperando) |

**Ordenação IA**: Botão "Prioridade IA" que reordena combinando:
- Peso 40: temperatura (QUENTE=1, MORNO=0.5, FRIO=0.1)
- Peso 30: SLA (quanto mais estourado, maior)
- Peso 20: intent (INTERESSE_COMPRA=1, outros=0.3)
- Peso 10: score_engajamento normalizado

## 3. Modo Kanban

- Toggle `Lista | Kanban` no header (ícones List/Columns)
- No Kanban, buscar etapas do pipeline do deal vinculado
- Agrupar conversas por `deal_stage_nome`
- Colunas horizontais com scroll, cards compactos (nome, última msg, tempo, badge temperatura)
- Coluna extra "Sem deal" para leads sem deal vinculado
- **Read-only** — sem drag-and-drop (gestão de estágio é no Pipeline)

## 4. Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `src/hooks/useAtendimentos.ts` | Enriquecer interface + query com deal stage, temperatura, modo, last_inbound_at |
| `src/pages/ConversasPage.tsx` | Adicionar toggle lista/kanban, filtros inteligentes, ordenação IA |
| `src/components/conversas/ConversasKanban.tsx` | **Novo** — componente Kanban read-only |
| `src/components/conversas/ConversasFilters.tsx` | **Novo** — chips de filtro inteligente |
| `src/components/conversas/ConversaCard.tsx` | **Novo** — card reutilizado em lista e kanban |

Nenhuma migration de banco necessária — todos os dados já existem.

