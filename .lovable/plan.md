
# Plano de Correções — Auditoria V2

Analisei linha a linha o documento do PO. Abaixo, o plano organizado pela prioridade da auditoria, com o que faremos em cada sprint.

---

## Sprint Urgente (Itens Criticos e Altos)

### 1. Migrar Edge Functions de Lovable AI Gateway para Anthropic API
**Problema 2.1 [CRITICO]**: 8 de 10 edge functions IA usam o gateway Lovable/Gemini. Risco de dependencia e qualidade inferior.

**Acao**: Migrar as 8 functions para chamar a Anthropic API diretamente (mesmo padrao do `sdr-ia-interpret`).

Functions a migrar:
- `copilot-chat`
- `next-best-action`
- `cs-daily-briefing`
- `cs-trending-topics`
- `amelia-mass-action`
- `amelia-learn`
- `ai-benchmark`
- `deal-loss-analysis`

**Tecnico**: Substituir o fetch para `ai.gateway.lovable.dev` por chamada direta a `https://api.anthropic.com/v1/messages` usando `ANTHROPIC_API_KEY` (secret). Modelo: `claude-sonnet-4-20250514`. Manter system prompt e logica de enriquecimento intactos.

**Pre-requisito**: Configurar secret `ANTHROPIC_API_KEY` no projeto.

---

### 2. Configurar pg_cron para Edge Functions CS
**Problema 2.2 [CRITICO]**: 7 functions CS foram criadas para rodar periodicamente mas nenhum CRON foi configurado. O modulo CS "nao pulsa".

**Acao**: Criar migration SQL com `pg_cron` + `pg_net` para agendar chamadas HTTP as functions.

| Function | Cron |
|----------|------|
| cs-health-calculator | Diario 6h |
| cs-nps-auto | Diario 9h |
| cs-churn-predictor | Diario 7h |
| cs-incident-detector | A cada 2h |
| cs-renewal-alerts | Diario 8h |
| cs-daily-briefing | Diario 8h30 |
| cadence-runner | A cada 15min |

**Tecnico**: Migration usando `cron.schedule()` + `net.http_post()` com `SUPABASE_URL` e `service_role_key`.

---

### 3. Fix GlobalSearch: PipelinePage e OrganizationsPage
**Problema 2.3 [ALTO]** e **2.11 [MEDIO]**: Busca global e NBA navegam para `/pipeline?deal=ID` e `/organizacoes?open=ID`, mas essas paginas nao leem os query params.

**Acao**:
- **PipelinePage**: Adicionar `useSearchParams` para ler `deal`. Se presente, abrir `DealDetailSheet` com o `deal` ID automaticamente.
- **OrganizationsPage**: Adicionar `useSearchParams` para ler `open`. Se presente, definir `selectedOrgId` com o valor.

**Arquivos**: `src/pages/PipelinePage.tsx`, `src/pages/OrganizationsPage.tsx`

---

### 4. Fix cs-nps-auto: Janela de 24h perde clientes
**Problema 2.6 [ALTO]**: Logica busca clientes com `data_primeiro_ganho` entre 90 e 91 dias atras. Se o CRON nao rodar naquele dia, o cliente e perdido.

**Acao**: Mudar logica para "clientes ativos sem NPS nos ultimos 90 dias" usando LEFT JOIN em `cs_surveys`.

**Arquivo**: `supabase/functions/cs-nps-auto/index.ts`

---

### 5. ErrorBoundary granular por secao
**Problema 2.5 [ALTO]**: Um unico ErrorBoundary envolve todas as rotas. Erro no CS derruba pipeline.

**Acao**: Agrupar rotas em `App.tsx` com `ErrorBoundary` por secao:
- Pipeline/Deals
- CS Module
- Conversas/Atendimentos
- Admin/Settings

**Arquivo**: `src/App.tsx`

---

## Sprint Funcional (Itens Medios)

### 6. Dashboard CS com briefing IA da Amelia
**Problema 2.7 [MEDIO]**: Edge function `cs-daily-briefing` existe mas Dashboard CS nao a chama.

**Acao**: Adicionar componente `CSDailyBriefingCard` no topo do `CSDashboardPage` que chama a function e exibe o briefing.

**Arquivos**: Novo `src/components/cs/CSDailyBriefingCard.tsx`, editar `src/pages/cs/CSDashboardPage.tsx`

---

### 7. CSClienteDetail: Adicionar tabs Deals e Renovacao
**Problema 2.8 [MEDIO]**: Faltam 4 tabs planejadas. Prioridade: Deals associados e Renovacao.

**Acao**: Adicionar 2 tabs ao `CSClienteDetailPage`:
- **Deals**: Listar deals do contato via `contact_id`
- **Renovacao**: Mostrar datas de renovacao, historico, e botao para registrar renovacao

**Arquivo**: `src/pages/cs/CSClienteDetailPage.tsx`

---

### 8. Botao "Enviar NPS via WhatsApp" no CSClienteDetail
**Problema 2.4 [ALTO]**: O "Registrar NPS" e data entry manual. Nao envia ao cliente.

**Acao**: Adicionar botao "Enviar NPS via WhatsApp" que chama `cs-nps-auto` com `customer_id` e `tipo: NPS`. Separar visualmente do "Registrar" manual.

**Arquivo**: `src/pages/cs/CSClienteDetailPage.tsx`

---

### 9. Paginacao em Contatos e Deals
**Problema 2.10 [MEDIO]**: Contatos com `.limit(200)` e deals sem limit.

**Acao**:
- `useContacts`: Implementar paginacao com `range()` e `PAGE_SIZE=25` (mesmo padrao CS)
- `useDeals`: Adicionar `.limit()` na query do Kanban (ou paginacao se aplicavel)

**Arquivos**: `src/hooks/useContacts.ts`, `src/hooks/useDeals.ts`

---

### 10. Limpeza: NavLink orfao e classification.ts
**Problema 2.12 [BAIXO]**: `classification.ts` re-exporta `EmpresaTipo` de `sgt.ts` ao inves de `enums.ts`.
**Problema residual**: `NavLink.tsx` e orfao.

**Acao**:
- Deletar `src/components/NavLink.tsx`
- Em `classification.ts`: mudar `export type { EmpresaTipo } from './sgt'` para `from './enums'`

---

## Resumo de Arquivos Impactados

| Arquivo | Mudanca |
|---------|---------|
| 8 edge functions IA | Migrar para Anthropic API |
| Migration SQL nova | pg_cron para 7 functions |
| `src/pages/PipelinePage.tsx` | Ler `?deal=` param |
| `src/pages/OrganizationsPage.tsx` | Ler `?open=` param |
| `supabase/functions/cs-nps-auto/index.ts` | Janela NPS 90d sem survey |
| `src/App.tsx` | ErrorBoundary por secao |
| `src/pages/cs/CSDashboardPage.tsx` | Briefing IA card |
| `src/pages/cs/CSClienteDetailPage.tsx` | Tabs + botao WhatsApp NPS |
| `src/hooks/useContacts.ts` | Paginacao |
| `src/hooks/useDeals.ts` | Limit na query |
| `src/components/NavLink.tsx` | Deletar |
| `src/types/classification.ts` | Fix import |

---

## Ordem de Execucao

Pela dependencia e impacto, a ordem e:

1. Configurar secret `ANTHROPIC_API_KEY`
2. Migrar as 8 edge functions para Anthropic
3. Criar migration pg_cron
4. Fix GlobalSearch (PipelinePage + OrganizationsPage + NBA)
5. Fix cs-nps-auto janela
6. ErrorBoundary granular
7. Dashboard CS briefing
8. CSClienteDetail tabs + NPS WhatsApp
9. Paginacao contatos/deals
10. Limpeza (NavLink, classification.ts)
