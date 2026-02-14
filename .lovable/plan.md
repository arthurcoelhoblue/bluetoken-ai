

# Auditoria V2 — Status de Atendimento Linha a Linha

Analisei cada item do relatório contra o codigo atual. Resultado: **a maioria foi atendida, mas 3 itens ficaram pendentes**.

---

## Itens Atendidos (OK)

| Item | Evidencia no Codigo |
|------|-------------------|
| 2.1 [CRITICO] Migrar IA para Anthropic | `copilot-chat`, `next-best-action`, `cs-daily-briefing`, `cs-trending-topics`, `amelia-mass-action`, `amelia-learn`, `deal-loss-analysis` - todos usando `api.anthropic.com/v1/messages` com `claude-sonnet-4-20250514` |
| 2.3 [ALTO] GlobalSearch navegacao | `PipelinePage.tsx` le `searchParams.get('deal')` na linha 44. `OrganizationsPage.tsx` le `searchParams.get('open')` na linha 24 |
| 2.4 [ALTO] NPS via WhatsApp | Botao "Enviar NPS via WhatsApp" em `CSClienteDetailPage.tsx` linha 146, chama `cs-nps-auto` com `tipo: 'NPS'` |
| 2.5 [ALTO] ErrorBoundary granular | `App.tsx` tem `ErrorBoundary` individual em cada rota (Pipeline, CS, Admin, Conversas) - linhas 100-158 |
| 2.6 [ALTO] cs-nps-auto janela 24h | Logica corrigida: busca clientes ativos e filtra os que nao tem NPS nos ultimos 90 dias via query individual |
| 2.7 [MEDIO] Dashboard CS briefing | `CSDailyBriefingCard` criado e integrado no topo do `CSDashboardPage` (linha 44) |
| 2.8 [MEDIO] CSClienteDetail tabs | Tabs "Deals" (linha 131) e "Renovacao" (linha 132) adicionadas com conteudo funcional |
| 2.10 [MEDIO] Paginacao contatos/deals | `useContacts` com `PAGE_SIZE=25` e `range()`. `useDeals` com `.limit(500)` |
| 2.11 [MEDIO] NBA navegacao | Resolvido junto com 2.3 (PipelinePage le `?deal=`) |
| 2.12 [BAIXO] classification.ts | Linha 6: `export type { EmpresaTipo } from './enums'` - corrigido |
| NavLink orfao | Deletado - busca por "NavLink" em `src/components` retorna zero resultados |

---

## Itens NAO Atendidos (3 pendentes)

### 1. [CRITICO] 2.2 — Zero CRON jobs (pg_cron)
**Status: NAO FEITO**

Nao existe nenhuma migration com `cron.schedule`. A busca por "cron" nas migrations retorna zero resultados. As 7 edge functions CS que deviam rodar automaticamente continuam sem agendamento.

Impacto: O modulo CS "nao pulsa" — health scores nao recalculam, NPS nao e disparado automaticamente, churn nao e predito, briefing nao e gerado, alertas de renovacao nao sao enviados.

**Acao**: Criar migration SQL com:
- `CREATE EXTENSION IF NOT EXISTS pg_cron;`
- 7 chamadas `cron.schedule()` com `net.http_post()` para as edge functions

### 2. [MEDIO] 2.9 — Playbooks CS nao executam
**Status: NAO ESTAVA NO PLANO**

O plano aprovado nao incluia este item. Os playbooks continuam sendo apenas CRUD — nenhuma engine dispara a execucao dos steps.

**Acao**: Criar edge function `cs-playbook-runner` que:
- Recebe trigger_type e customer_id
- Busca playbooks ativos com aquele trigger
- Executa os steps (notificacao, tarefa, email, WhatsApp)
- Integrar com triggers existentes (health change, incident, renewal)

### 3. [BAIXO] 2.13 — CS Pesquisas page read-only
**Status: NAO ESTAVA NO PLANO**

A pagina `/cs/pesquisas` continua sem botao para enviar nova pesquisa.

**Acao**: Adicionar botao "Enviar Pesquisa" que abre dialog para selecionar cliente e tipo (NPS/CSAT), chamando `cs-nps-auto`.

---

## Ressalva: ai-benchmark ainda usa Google API

O `ai-benchmark` foi parcialmente migrado — ele usa Google Direct API como primario (com `GOOGLE_API_KEY`) e Anthropic como fallback. Nao depende mais do gateway Lovable, mas ainda prioriza Google/Gemini. O relatorio pedia migracao total para Anthropic.

Alem disso, `sdr-ia-interpret` e `integration-health-check` ainda referenciam `ai.gateway.lovable.dev` (2 funcoes que nao estavam na lista de 8).

---

## Resumo

| Categoria | Total | Atendido | Pendente |
|-----------|-------|----------|----------|
| CRITICO | 2 | 1 | 1 (pg_cron) |
| ALTO | 4 | 4 | 0 |
| MEDIO | 5 | 3 | 2 (playbooks, pesquisas) |
| BAIXO | 2 | 1 | 1 (pesquisas) |
| **Total** | **13** | **10** | **3** |

---

## Plano de Resolucao dos 3 Pendentes

### Passo 1: pg_cron migration (CRITICO)
Criar migration SQL que habilita `pg_cron` e agenda as 7 functions:

```text
cs-health-calculator  -> 0 6 * * *    (diario 6h)
cs-nps-auto           -> 0 9 * * *    (diario 9h)
cs-churn-predictor    -> 0 7 * * *    (diario 7h)
cs-incident-detector  -> 0 */2 * * *  (cada 2h)
cs-renewal-alerts     -> 0 8 * * *    (diario 8h)
cs-daily-briefing     -> 30 8 * * *   (diario 8h30)
cadence-runner        -> */15 * * * * (cada 15min)
```

### Passo 2: ai-benchmark full Anthropic
Remover a logica Google Direct do `ai-benchmark` e usar apenas Anthropic como provider.

### Passo 3: Botao "Enviar Pesquisa" em CSPesquisasPage
Adicionar dialog simples com select de cliente + tipo, chamando `cs-nps-auto`.

### Passo 4: Playbooks Engine (maior esforco)
Criar `cs-playbook-runner` edge function + integrar com triggers de health change e resolucao de incidencia.

### Arquivos impactados
| Arquivo | Mudanca |
|---------|---------|
| Nova migration SQL | pg_cron + cron.schedule para 7 functions |
| `supabase/functions/ai-benchmark/index.ts` | Remover Google, usar so Anthropic |
| `src/pages/cs/CSPesquisasPage.tsx` | Botao enviar pesquisa |
| Nova edge function `cs-playbook-runner` | Engine de execucao de playbooks |
| Triggers SQL | Chamar playbook-runner em health change e incident resolve |

