
# Plano Completo: Resolucao de Todos os Itens da Auditoria Tecnica

Este plano cobre **todos os 26 itens pendentes e parciais** identificados no relatorio de auditoria, organizados em 8 blocos de trabalho sequenciais.

---

## Bloco 1: Limpeza de Codigo e Consolidacao de Tipos

**Objetivo:** Eliminar divida tecnica estrutural.

### 1.1 Consolidar arquivos de tipo duplicados
- Atualizar todos os imports de `@/types/patch12` para `@/types/projection` (5 arquivos: `usePatch12.ts`, `usePatch12.test.ts`, `AmeliaMassActionPage.tsx`, `ProjecaoStageCard.tsx`)
- Atualizar todos os imports de `@/types/patch13` para `@/types/telephony` (4 arquivos: `useZadarma.ts`, `DealCallsPanel.tsx`, `ZadarmaConfigPage.tsx`, `ZadarmaPhoneWidget.tsx`)
- Renomear `usePatch12.ts` para `useProjections.ts` e atualizar imports
- Deletar `src/types/patch12.ts` e `src/types/patch13.ts` (re-exports orfaos)

### 1.2 Remover console.log/warn/error de producao
- Substituir os ~155 `console.error` em hooks e componentes por tratamento silencioso (os erros ja sao capturados pelo React Query e ErrorBoundary)
- Manter apenas: `ErrorBoundary.tsx`, `NotFound.tsx`, e edge functions (onde logs sao uteis)
- Nos hooks, remover `console.error` antes do `throw error` (redundante -- React Query ja captura)

### 1.3 Corrigir `score_probabilidade` no DealCard
- O campo `score_probabilidade` ja existe no tipo `DealWithRelations` e na tabela `deals`
- Remover os 5 casts `(deal as any).score_probabilidade` no `DealCard.tsx` e acessar diretamente como `deal.score_probabilidade`

### 1.4 Reduzir `as any` nos hooks principais
- **`usePipelineConfig.ts`**: Tipar corretamente os payloads de insert/update usando tipos do Supabase gerados
- **`useContactsPage.ts`**: Usar casting para tipo da view `contacts_with_stats` em vez de `as any`
- **`useCadenciasCRM.ts`**: Tipar retornos de queries corretamente
- **`useAmeliaLearnings.ts`**: Substituir `'amelia_learnings' as any` por tipo correto (a tabela ja esta no schema)
- **`useDealDetail.ts`**: Substituir `'deals_full_detail' as any` por casting tipado
- Objetivo: reduzir de ~279 para menos de 50 ocorrencias de `as any`

---

## Bloco 2: Paginacao Real (Server-side)

**Objetivo:** Substituir paginacao client-side por `.range()` onde possivel.

### 2.1 `useContactsPage.ts`
- A view `contacts_with_stats` ja suporta `count: 'exact'`
- Implementar `.range(from, to)` baseado em pagina e pageSize
- Mover logica de paginacao do componente para o hook

### 2.2 `useOrganizationsPage.ts`
- Mesmo padrao: adicionar `.range()` na query
- Propagar page/pageSize como parametros do hook

### 2.3 `useSgtEvents.ts`
- Adicionar `.range()` para eventos SGT (ja tem `.limit()`)

### 2.4 `useAtendimentos.ts` (manter client-side)
- Conforme ja documentado, a paginacao client-side e necessaria aqui pela complexidade do merge de 4 tabelas
- Adicionar comentario explicativo no codigo

---

## Bloco 3: Realtime Subscriptions

**Objetivo:** Adicionar subscricoes realtime para dados criticos.

### 3.1 Kanban (deals)
- Em `useDeals.ts`, adicionar subscription `postgres_changes` na tabela `deals` filtrada por `pipeline_id`
- Invalidar query `['deals']` ao receber evento `UPDATE` ou `INSERT`
- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;`

### 3.2 Workbench SLA Alerts
- Em `useWorkbench.ts`, adicionar channel para `workbench_sla_alerts` (view materializada precisa de tabela base)
- Alternativa: reduzir `refetchInterval` de 60s para 30s e adicionar realtime na tabela `deals` para invalidar SLA

### 3.3 Tarefas do Workbench
- Subscription na tabela `deal_activities` filtrada por `user_id` para tarefas pendentes
- Invalidar queries de tarefas ao receber eventos

---

## Bloco 4: RenovacaoPage -- Remover Hardcode

**Objetivo:** Eliminar dependencia de `nome.includes('renovacao')`.

### 4.1 Adicionar campo `tipo` na tabela `pipelines`
- Migration: `ALTER TABLE pipelines ADD COLUMN tipo TEXT DEFAULT 'COMERCIAL';`
- Valores: `COMERCIAL`, `RENOVACAO`, `POS_VENDA`, `CUSTOM`
- Atualizar pipelines existentes que contenham "renovacao" no nome

### 4.2 Atualizar `RenovacaoPage.tsx`
- Filtrar por `p.tipo === 'RENOVACAO'` em vez de `nome.includes('renovacao')`
- Atualizar mensagem de fallback para instruir a marcar o tipo do pipeline

### 4.3 Atualizar `PipelineConfigPage`
- Adicionar campo `tipo` no formulario de criacao/edicao de pipeline

---

## Bloco 5: Copilot-Chat -- Enriquecimento Completo

**Objetivo:** Completar o enriquecimento de contexto no copilot.

### 5.1 `enrichLeadContext`
- Ja busca organizacao via telefone -- manter
- Adicionar busca de `custom_field_values` para o contato vinculado ao lead (via `contacts.legacy_lead_id`)
- Adicionar intents recentes do lead (`lead_message_intents` ultimos 5)

### 5.2 `enrichPipelineContext`
- Corrigir campos: `p.total_deals` e `p.valor_total` nao existem na view `workbench_pipeline_summary`
- Usar `p.deals_abertos`, `p.valor_aberto`, `p.valor_ganho` (campos reais)
- Adicionar filtro por `empresa`

### 5.3 `enrichGeralContext`
- Mesma correcao de campos da pipeline
- Adicionar metricas basicas: total de deals abertos, valor total, SLA estourados

---

## Bloco 6: Funcionalidades IA-First (Auditoria Secao 7)

**Objetivo:** Implementar os itens IA-first pendentes.

### 6.1 Score de Probabilidade no DealCard (ja implementado parcialmente)
- A funcao `fn_calc_deal_score` e o trigger `trg_update_deal_score` ja existem
- O `DealCard.tsx` ja exibe o score (com `as any` -- corrigido no Bloco 1)
- Verificar que o trigger esta ativo e os scores estao sendo calculados

### 6.2 Auto-preenchimento de campos via conversa
- No `sdr-ia-interpret`, quando acao = `CRIAR_TAREFA_CLOSER`:
  - Extrair dados da conversa (valor mencionado, necessidade, urgencia) -- ja existe parcialmente
  - Preencher `score_engajamento`, `score_intencao`, `score_valor`, `score_urgencia` no deal criado
  - Isso alimenta o `fn_calc_deal_score` automaticamente

### 6.3 Analise de sentimento nas mensagens
- Adicionar campo `sentimento` (POSITIVO/NEUTRO/NEGATIVO) no retorno do `sdr-ia-interpret`
- Salvar no `lead_message_intents` (necessita coluna nova)
- Exibir indicador visual no historico de mensagens

---

## Bloco 7: Seguranca e Configuracao

### 7.1 Revisar RLS da tabela `amelia_learnings`
- Confirmar que politicas de leitura filtram por empresa
- Confirmar que escrita so e possivel via service_role

### 7.2 Validar publication realtime
- Garantir que apenas tabelas necessarias estao na publication `supabase_realtime`

---

## Bloco 8: Testes e Validacao

### 8.1 Atualizar testes existentes
- `usePatch12.test.ts` -- renomear para `useProjections.test.ts`
- `useDeals.test.ts` -- remover `as any` nos mocks
- `useContacts.test.ts` -- atualizar se houver mudancas de tipo

### 8.2 Validar score de probabilidade
- Testar que deals abertos recebem score ao mudar de estagio/temperatura
- Verificar que deals fechados tem score = 0

---

## Resumo de Arquivos Afetados

| Bloco | Arquivos | Tipo |
|-------|----------|------|
| 1 | ~20 arquivos com imports, `DealCard.tsx`, hooks | Refactor |
| 2 | `useContactsPage.ts`, `useOrganizationsPage.ts`, `useSgtEvents.ts` | Refactor |
| 3 | `useDeals.ts`, `useWorkbench.ts` + migration realtime | Feature |
| 4 | `RenovacaoPage.tsx`, `PipelineConfigPage.tsx` + migration | Feature |
| 5 | `copilot-chat/index.ts` | Bugfix + Feature |
| 6 | `sdr-ia-interpret/index.ts`, `DealCard.tsx` + migration | Feature |
| 7 | Migrations RLS | Security |
| 8 | Arquivos de teste | Test |

## Ordem de Execucao Recomendada

1. **Bloco 1** (limpeza) -- sem risco, fundacao para o resto
2. **Bloco 4** (RenovacaoPage) -- migration simples + refactor
3. **Bloco 2** (paginacao) -- refactor de hooks
4. **Bloco 5** (copilot) -- bugfix nos campos errados
5. **Bloco 3** (realtime) -- migration + subscriptions
6. **Bloco 6** (IA-first) -- migration + edge function
7. **Bloco 7** (seguranca) -- validacao
8. **Bloco 8** (testes) -- final

---

## Estimativa

- **Migrations necessarias**: 3 (realtime, tipo pipeline, sentimento)
- **Arquivos modificados**: ~30
- **Arquivos deletados**: 2 (patch12.ts, patch13.ts)
- **Arquivos renomeados**: 1 (usePatch12 -> useProjections)
- **Risco**: Baixo a medio (maioria e refactor sem mudanca de comportamento)
