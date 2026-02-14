
# Auditoria V2 — Secao 5 e 6: Analise Linha a Linha

---

## Secao 5: Gaps IA-First Restantes

| # | Gap V1 | Status V2 | Status Real | Evidencia |
|---|--------|-----------|-------------|-----------|
| 1 | Meu Dia sem Next Best Action | IMPLEMENTADO | **OK (corrigido)** | `NextBestActionCard` usa Anthropic (`claude-sonnet-4-20250514`). Navegacao para deal funciona via `navigate(/pipeline?deal=ID)` e `PipelinePage` le o param. |
| 2 | Pipeline sem scoring/probabilidade | PARCIAL | **OK** | `fn_calc_deal_score` existe em migration. Trigger `trg_update_deal_score` recalcula automaticamente. `DealCard.tsx` exibe `score_probabilidade` com cores verde/amarelo/vermelho e tooltip. Campo existe no DB (`types.ts` linha 2190). |
| 3 | Nenhuma notificacao proativa | IMPLEMENTADO | **OK** | `NotificationBell` + tabela `notifications` + realtime + browser push confirmados. |
| 4 | Deal creation nao e automatica | NAO IMPLEMENTADO | **IMPLEMENTADO** | `sdr-ia-interpret` linhas 3106-3176 implementa auto-create deal quando IA detecta INTERESSE_COMPRA. Cria deal com titulo, valor e temperatura extraidos da conversa. |
| 5 | Sem auto-fill de campos via IA | NAO IMPLEMENTADO | **NAO IMPLEMENTADO** | Zero referencias a auto-fill ou auto-preenchimento de campos. Vendedor preenche tudo manualmente. |
| 6 | Sem sumarizacao de chamadas | NAO IMPLEMENTADO | **NAO IMPLEMENTADO** | Zadarma integration existe mas sem transcricao/resumo. Nenhuma edge function de sumarizacao de chamadas. |
| 7 | Email compose na conversa | NAO IMPLEMENTADO | **PARCIAL** | `EmailFromDealDialog` existe e funciona, mas SOMENTE dentro do `DealDetailSheet`. Nao esta acessivel na tela de Conversas (`ConversationPanel`). |
| 8 | Sentimento em tempo real na conversa | PARCIAL | **NAO IMPLEMENTADO** | `cs-incident-detector` analisa sentimento retroativamente. Porem ZERO componentes de sentimento no `ConversationView` ou `ConversationPanel`. Nenhum badge/indicador visual de sentimento nas mensagens. |

### Resumo Secao 5
- **OK**: 4 de 8 (itens 1, 2, 3, 4)
- **Parcial**: 1 de 8 (item 7)
- **NAO implementado**: 3 de 8 (itens 5, 6, 8)

---

## Secao 6: Roadmap de Correcao V2

### Sprint Urgente (1-2 dias)

| # | Acao | Status Real |
|---|------|-------------|
| 1 | Migrar TODAS edge functions para Anthropic | **OK** — 8 functions migradas. `sdr-ia-interpret` usa Google Direct como primario (nao gateway Lovable), Anthropic como fallback. |
| 2 | Configurar pg_cron para 7 functions CS | **FEITO** — 7 cron jobs configurados via SQL direto |
| 3 | Fix GlobalSearch: PipelinePage e OrganizationsPage lerem params | **OK** — Ambos leem `?deal=` e `?open=` |
| 4 | Fix cs-nps-auto: janela 90 dias | **OK** — Logica corrigida |
| 5 | ErrorBoundary por secao | **OK** — Granular em App.tsx |

### Sprint Funcional (3-5 dias)

| # | Acao | Status Real |
|---|------|-------------|
| 6 | Botao "Enviar NPS via WhatsApp" no CSClienteDetail | **OK** — Implementado |
| 7 | Adicionar tabs Deals + Renovacao no CSClienteDetail | **OK** — 2 tabs adicionadas |
| 8 | Dashboard CS com briefing IA da Amelia | **OK** — `CSDailyBriefingCard` integrado |
| 9 | Engine de execucao para Playbooks CS | **OK** — `cs-playbook-runner` edge function criada |
| 10 | Paginacao em contatos e deals | **OK** — `useContacts` paginado, `useDeals` com limit |
| 11 | Fix NBA card navegacao para deal | **OK** — Funciona via `?deal=` param |

### Sprint Evolucao (1-2 semanas)

| # | Acao | Status Real |
|---|------|-------------|
| 12 | Deal scoring de probabilidade no pipeline (IA) | **OK** — `fn_calc_deal_score` + trigger + exibicao no `DealCard` |
| 13 | Deal auto-creation de lead qualificado | **OK** — Implementado no `sdr-ia-interpret` linhas 3106-3176 |
| 14 | CSAT automatico apos resolucao de incidencia | **OK** — Trigger `fn_cs_auto_csat_on_resolve` na migration |
| 15 | Sentimento em tempo real na conversa (badge) | **NAO IMPLEMENTADO** — Zero componentes visuais de sentimento nas mensagens |
| 16 | Tests para hooks CS e edge functions | **NAO IMPLEMENTADO** — Cobertura continua ~3%, nenhum teste novo para CS |

---

## Itens Pendentes para 100%

### 1. [MEDIO] Sentimento em tempo real na conversa (Secao 5 item 8 / Roadmap item 15)
O `sdr-ia-interpret` ja salva `sentiment_score` e `sentiment` na tabela `lead_message_intents`. Porem nenhum componente visual exibe isso durante a conversa.

**Acao**: No `ConversationView.tsx`, para cada mensagem INBOUND, buscar o `lead_message_intents` correspondente e exibir um badge colorido (positivo/neutro/negativo) ao lado da mensagem.

**Arquivo**: `src/components/messages/ConversationView.tsx`

### 2. [MEDIO] Email compose na conversa (Secao 5 item 7)
O `EmailFromDealDialog` so esta no `DealDetailSheet`. Falta na tela de Conversas.

**Acao**: Adicionar botao "Enviar Email" no `ManualMessageInput` ou `ConversationPanel` que abre o `EmailFromDealDialog` (reutilizando o componente existente).

**Arquivo**: `src/components/conversas/ConversationPanel.tsx` ou `ManualMessageInput.tsx`

### 3. [BAIXO] Auto-fill de campos via IA (Secao 5 item 5)
Quando a IA cria um deal automaticamente, ela ja extrai `valor_mencionado`, `necessidade_principal` e `urgencia` da conversa. Porem ao criar um deal manualmente, o vendedor nao tem sugestoes.

**Acao**: No `CreateDealDialog`, ao selecionar um contato, buscar os ultimos `lead_message_intents` e pre-preencher campos como valor, temperatura e titulo com base nos dados extraidos pela IA.

**Arquivo**: `src/components/pipeline/CreateDealDialog.tsx`

### 4. [BAIXO] Sumarizacao de chamadas (Secao 5 item 6)
Zadarma registra chamadas mas sem transcricao/resumo. Isso requer integracao com API de transcricao (Whisper ou similar) que esta fora do escopo da Zadarma proxy atual.

**Acao**: Aceitar como "fora de escopo" desta auditoria. Requer API de transcricao de audio (Whisper, Deepgram, etc.) + novo fluxo de processamento.

### 5. [BAIXO] Testes CS e edge functions (Roadmap item 16)
Cobertura continua ~3%. Nenhum teste novo foi criado.

**Acao**: Criar testes basicos para:
- `useCSCustomers`, `useCSMetrics` (hooks CS)
- `cs-health-calculator`, `cs-nps-auto` (edge functions)
- Manter como melhoria incremental

---

## Plano de Execucao (3 acoes implementaveis)

| Prioridade | Acao | Esforco |
|-----------|------|---------|
| 1 | Badge de sentimento no ConversationView | 2h |
| 2 | Botao Email no ConversationPanel | 1h |
| 3 | Auto-fill no CreateDealDialog | 2h |
| - | Sumarizacao de chamadas | Fora de escopo |
| - | Testes CS | Melhoria incremental |

### Arquivos Impactados
| Arquivo | Mudanca |
|---------|---------|
| `src/components/messages/ConversationView.tsx` | Badge sentimento por mensagem |
| `src/components/conversas/ManualMessageInput.tsx` | Botao email compose |
| `src/components/pipeline/CreateDealDialog.tsx` | Auto-fill IA nos campos |
