

## Plano Revisado: Módulo Playbook de Vendas — Implementação 11/10

### Sobre o ponto 3 (Webhook)

O plano original propunha um tipo de step chamado `WEBHOOK` dentro do playbook — um passo que dispararia uma chamada HTTP externa (ex: notificar um ERP, disparar um sistema de propostas, ou acionar uma automação externa). Na prática, isso é over-engineering para o momento. O sistema já tem webhooks de ENTRADA (SGT, Elementor, WhatsApp, Meta) e edge functions que fazem chamadas externas quando necessário. Se amanhã surgir a necessidade de "ao chegar no step X, acionar sistema Y", isso se resolve com um step tipo TAREFA que chama uma edge function específica — sem precisar de um tipo genérico WEBHOOK no motor. **Recomendação: remover e não implementar.**

---

### Decisões incorporadas

| Ponto | Decisão |
|---|---|
| 1. Performance | Views e queries de observabilidade criadas na Fase 1 |
| 3. Webhook | Removido como tipo de step (desnecessário) |
| 6. Tipos | Apenas `VENDAS` — gestor cria múltiplas variações do playbook |
| 7. | Movido para Fase 4 |
| 8. IA | Fase 5.1 e 5.2, implementação imediata |
| 12. Conflito | Playbook ativo pausa cadência automaticamente |
| 13. Mobile | Layout mobile-first em todos os componentes |

### Tipos de Step Finais (5 tipos)

| Tipo | Executor | Descrição |
|---|---|---|
| `MENSAGEM_AUTO` | IA | IA envia WhatsApp/Email automaticamente |
| `MENSAGEM_MANUAL` | HUMANO | Vendedor envia mensagem (template sugerido) |
| `LIGACAO` | HUMANO | Vendedor faz ligação (script sugerido pela IA) |
| `REUNIAO` | HUMANO | Vendedor participa de reunião (Google Calendar) |
| `TAREFA` | HUMANO | Tarefa genérica (preparar proposta, pesquisar lead, etc.) |

---

### Fase 1 — Fundação (3-4 dias)

**Banco de dados:**

Tabelas:
- `playbooks` — Molde do playbook (apenas tipo VENDAS, vinculado a empresa, pipeline opcional, versão, parent_id para variações)
- `playbook_steps` — Passos do molde (5 tipos acima, offset em dias+horas, fallback configurável, metadata JSONB para scripts/checklists)
- `deal_playbook_runs` — Instância ativa para um deal (status, current_step, next_step_at, owner_id)
- `deal_playbook_events` — Log de tudo que acontece (tipo_evento, notas do vendedor, resultado, ai_response)

Sem tabela `playbook_analytics` — métricas calculadas on-demand via queries/views.

Enums simplificados:
- `playbook_step_tipo`: 5 valores
- `playbook_executor`: IA | HUMANO
- `playbook_run_status`: ATIVA | CONCLUIDA | PAUSADA | CANCELADA | AGUARDANDO_HUMANO
- `playbook_evento_tipo`: AGENDADO | EXECUTADO | PULADO | ATRASADO | FALLBACK_IA | PAUSADO | RETOMADO | CANCELADO | ESCALADO

RLS usando `has_role()` e `get_user_empresas()` (padrões existentes do sistema).

Trigger: `deal_playbook_event → deal_activities` (cada step executado cria atividade na timeline do deal).

Trigger: ao criar `deal_playbook_runs` com status ATIVA, pausar automaticamente `lead_cadence_runs` ativas do mesmo deal (`UPDATE lead_cadence_runs SET status = 'PAUSADA' WHERE deal_id = X AND status = 'ATIVA'`).

**Views de performance:**
- `v_playbook_stats` — runs por playbook (total, concluídos, cancelados, tempo médio de ciclo)
- `v_playbook_step_performance` — por step (taxa de conclusão no prazo, atrasos, fallbacks)
- `v_playbook_vendedor_aderencia` — por vendedor (steps no prazo, atrasados, fallbacks)

**Tipos TypeScript:** `src/types/playbook.ts`

**Arquivos:**
- Migration SQL
- `src/types/playbook.ts`

---

### Fase 2 — Motor de Execução (5-7 dias)

**Edge Function `playbook-runner`** (CRON a cada 5 min, mesmo padrão do cadence-runner):

```text
CRON → Busca runs com next_step_at <= now()
  → Para cada run:
    → Lock otimista (mesmo padrão do cadence-runner)
    → Verificar horário comercial
    → Se step é IA:
      → Executar (whatsapp-send / email-send existentes)
      → Registrar evento EXECUTADO
      → Avançar para próximo step
    → Se step é HUMANO e status = ATIVA:
      → Criar notificação para vendedor
      → Criar deal_activity tipo TAREFA
      → Mudar status → AGUARDANDO_HUMANO
    → Se step é HUMANO e status = AGUARDANDO_HUMANO:
      → Verificar atraso
      → 1x prazo → lembrete (notificação)
      → 2x prazo → escalar para gestor
      → Se fallback habilitado → IA assume
```

**Hooks React:**
- `src/hooks/playbooks/usePlaybookRuns.ts` — CRUD de runs, completeStep, skipStep, pauseRun
- `src/hooks/playbooks/usePlaybookEvents.ts` — log de eventos
- `src/lib/playbook-utils.ts` — cálculo de timing, formatação

**Regra de convivência cadência × playbook:**
- Trigger no banco: INSERT em `deal_playbook_runs` com status ATIVA → pausa cadências ativas do deal
- No `cadence-runner`: antes de processar run, verificar se deal tem playbook ativo → skip se sim

---

### Fase 3 — UI Básica (5-7 dias)

**Página `/playbooks`** — Lista de playbooks do tipo VENDAS, filtro por empresa, CRUD, duplicar (para criar variações)

**Editor `/playbooks/:id/edit`** — Timeline vertical com steps arrastáveis (dnd-kit), sidebar de propriedades do step selecionado, preview visual

**Timeline no Deal** — Dentro da sheet de detalhes do deal, seção "Playbook" mostrando:
- Progresso (barra)
- Steps executados (com notas e resultados)
- Step atual (com botão "Marcar como feito", "Adiar", "Pular")
- Steps futuros (agendados)

**Seletor de Playbook** — Quando deal não tem playbook ativo, mostrar seletor com playbooks disponíveis

**Badge no Kanban** — Indicador visual nos cards do pipeline quando deal tem playbook ativo

**Mobile-first:** Todos os componentes responsivos, ações do step com touch targets de 44px mínimo, timeline vertical otimizada para mobile

**Componentes:**
- `PlaybooksPage.tsx`
- `PlaybookEditorPage.tsx`
- `PlaybookTimeline.tsx`
- `PlaybookStepCard.tsx`
- `PlaybookStepEditor.tsx`
- `PlaybookSelector.tsx`
- `PlaybookActionDialog.tsx`
- `PlaybookBadge.tsx`
- `usePlaybooks.ts`
- `usePlaybookSteps.ts`

---

### Fase 4 — "Meu Dia", Notificações e Gamificação (4-6 dias)

**Expansão do Workbench:**
- Seção "Playbook do Dia" com steps humanos pendentes organizados por horário
- Narrativa da IA sobre o dia do vendedor
- Seção "Ações da IA" mostrando o que a IA fez automaticamente

**Notificações:**
- Step humano agendado → push + in-app
- Step atrasado (1h, 4h) → push + in-app
- Fallback IA executado → in-app
- Escalação → push para gestor
- Playbook concluído → in-app

**Google Calendar:** Steps REUNIAO criam eventos automaticamente via `calendar-book`

**Next Best Action:** Expandir para incluir steps de playbook pendentes

**Gamificação:**
- Pontos por step concluído no prazo
- Pontos por playbook concluído
- Badge por aderência ao playbook (>90% steps no prazo)

---

### Fase 5 — IA Avançada

**5.1 — Sugestão e Scripts (3-4 dias):**
- `playbook-suggest` — IA analisa contexto do deal e sugere playbook ideal
- Scripts dinâmicos — para steps LIGACAO e MENSAGEM_MANUAL, IA gera scripts personalizados com base no contexto acumulado
- Usar dados existentes do deal (temperatura, score, qualificação SPIN/GPCT, histórico de conversa) para calibrar

**5.2 — Adaptação e Análise (3-4 dias):**
- `playbook-adapt` — IA sugere adaptações quando eventos ocorrem (lead respondeu, temperatura mudou, deal avançou)
- `playbook-analyze` — Step tipo ANALISE_IA executado entre steps humanos, gerando recomendações
- Triggers automáticos de adaptação

---

### Cronograma estimado

| Fase | Escopo | Duração |
|---|---|---|
| 1 | Fundação + Views de performance | 3-4 dias |
| 2 | Motor de execução + conflito cadência | 5-7 dias |
| 3 | UI completa (mobile-first) | 5-7 dias |
| 4 | Meu Dia + Notificações + Gamificação | 4-6 dias |
| 5.1 | IA: Sugestão + Scripts | 3-4 dias |
| 5.2 | IA: Adaptação + Análise | 3-4 dias |
| **Total** | | **23-32 dias** |

### Implementação

Fase 1 será implementada primeiro. Cada fase entrega valor incremental — o sistema é utilizável a partir da Fase 3.

