

# Auditoria V2 Secao 1 — Analise Linha a Linha + Plano de Correcao

Revisei item a item da Secao 1 ("O Que Foi Corrigido da Auditoria V1") contra o codigo atual.

---

## Status Real de Cada Item

| # | Problema V1 | Status Auditoria | Status Real | Pendencia |
|---|-------------|-----------------|-------------|-----------|
| 1 | Zero Error Boundaries | CORRIGIDO | OK | Nenhuma |
| 2 | QueryClient sem config | CORRIGIDO | OK | Nenhuma |
| 3 | Zero Code Splitting | CORRIGIDO | OK | Nenhuma |
| 4 | GlobalSearch navegacao | PARCIAL | PARCIAL | PipelinePage OK (le `?deal=`). OrganizationsPage OK (le `?open=`). Contatos OK (le `?open=`). **Status real: 3/3 corrigidos** |
| 5 | SDR-IA queima tokens MANUAL | CORRIGIDO | OK | Nenhuma |
| 6 | Apenas 1 realtime subscription | CORRIGIDO | OK | Nenhuma |
| 7 | 195 castings as any | PARCIAL | PARCIAL | Ainda ~110 `as any` em 18 arquivos. CS hooks tem 13 deles. |
| 8 | Empresa casing inconsistente | CORRIGIDO | PARCIAL | `toUpperCase()` residuais: 2 legitimos (initials/avatars), mas `useImportacao.ts` linha 18 ainda faz `activeCompany?.toUpperCase()` — potencial inconsistencia |
| 9 | EmpresaTipo definida 4x | CORRIGIDO | OK | `enums.ts` como single source. `classification.ts` ja corrigido |
| 10 | Zero paginacao real | PARCIAL | PARCIAL | CS hooks: OK (PAGE_SIZE=25). `useContacts`: OK (PAGE_SIZE=25 com range). `useDeals`: **ainda sem paginacao real** — apenas `.limit(500)` sem range/offset |
| 11 | Cobertura testes ~2% | PARCIAL | PARCIAL | 9 arquivos de teste. Cobertura ~3%. Nenhum teste novo foi criado nesta auditoria |
| 12 | Copilot usa Gemini | NAO CORRIGIDO | **CORRIGIDO** | `copilot-chat` agora usa Anthropic direto. `amelia-learn`, `daily-briefing`, `trending-topics`, `next-best-action`, `mass-action` tambem. Porem `sdr-ia-interpret` e `integration-health-check` ainda usam gateway Lovable |
| 13 | Duplicacao de tipos | CORRIGIDO | OK | Nenhuma |
| 14 | Componentes orfaos | CORRIGIDO | OK | NavLink.tsx deletado |
| 15 | IntegracoesPage shell vazio | CORRIGIDO | OK | Nenhuma |
| 16 | RenovacaoPage depende de nome | CORRIGIDO | OK | Nenhuma |
| 17 | Sem validacao com library | CORRIGIDO | OK | Nenhuma |
| 18 | Console.logs em producao | CORRIGIDO | OK | Nenhuma |
| 19 | Cadence Runner sem scheduler | NAO CORRIGIDO | **NAO CORRIGIDO** | Zero `cron.schedule` encontrados em migrations ou SQL. Nenhum job pg_cron configurado |

---

## Itens Pendentes (4 acoes)

### 1. [CRITICO] Item 19 — pg_cron nao configurado
**Problema**: Nenhuma migration com `cron.schedule` existe. Os 7 jobs CS + cadence-runner nao estao agendados.

**Acao**: Executar SQL direto (nao migration, pois contem dados especificos do projeto como URL e anon key) para criar os 7 cron jobs:

```text
cs-health-calculator    -> 0 6 * * *
cs-nps-auto             -> 0 9 * * *
cs-churn-predictor      -> 0 7 * * *
cs-incident-detector    -> 0 */2 * * *
cs-renewal-alerts       -> 0 8 * * *
cs-daily-briefing       -> 30 8 * * *
cadence-runner          -> */15 * * * *
```

### 2. [ALTO] Item 10 — Deals sem paginacao real
**Problema**: `useDeals` usa apenas `.limit(500)` sem `range()`. Para pipelines com muitos deals, nao ha como paginar.

**Acao**: O Kanban carrega todos os deals do pipeline de uma vez (necessidade do drag-and-drop). O `.limit(500)` e aceitavel para Kanban. Porem, listas de deals em outras paginas (ex: CSClienteDetail tab Deals) devem usar paginacao. Manter `.limit(500)` no Kanban mas documentar a limitacao.

### 3. [ALTO] Item 12 residual — sdr-ia-interpret e integration-health-check
**Problema**: 2 edge functions ainda usam `ai.gateway.lovable.dev`:
- `sdr-ia-interpret` (linha 2730) — funcao mais critica do sistema
- `integration-health-check` (linha 196)

**Acao**: Migrar ambas para Anthropic API direto, mesmo padrao das 8 ja migradas.

### 4. [MEDIO] Item 7 — Reduzir castings `as any`
**Problema**: 110 `as any` em 18 arquivos. CS hooks tem 13 sozinhos.

**Acao**: Nos hooks CS, os `as any` sao causados por tabelas que nao estao no types.ts gerado (cs_surveys, cs_incidents, cs_playbooks). Estes casts sao necessarios enquanto as tabelas nao forem adicionadas ao schema de tipos. Marcar como "aceito com ressalva" — resolver quando types.ts for regenerado.

---

## Resumo do Plano

| Prioridade | Acao | Arquivos |
|-----------|------|----------|
| CRITICO | Configurar pg_cron com 7 jobs | SQL direto (nao migration) |
| ALTO | Migrar sdr-ia-interpret para Anthropic | `supabase/functions/sdr-ia-interpret/index.ts` |
| ALTO | Migrar integration-health-check para Anthropic | `supabase/functions/integration-health-check/index.ts` |
| MEDIO | Documentar limitacao Kanban 500 deals | Nenhum arquivo (aceito) |
| MEDIO | `as any` aceitos com ressalva ate regenerar types | Nenhum arquivo |

### Ordem de Execucao
1. Configurar pg_cron SQL (7 jobs)
2. Migrar `sdr-ia-interpret` para Anthropic
3. Migrar `integration-health-check` para Anthropic

