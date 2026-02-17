

# Plano: Consolidacao Seletiva de Edge Functions + Docs de API

---

## Contexto

Existem 46 Edge Functions deployadas (excluindo `_shared/`). A maioria tem responsabilidade clara e justifica existir separadamente (webhooks, integracao externa, CRON jobs). Porem, ha oportunidades concretas de consolidacao em dois grupos, alem de lacunas na documentacao de API.

---

## Parte 1: Consolidacao Seletiva de Edge Functions

### Grupo A -- SDR Pipeline (4 funcoes internas para 0 deployadas)

Atualmente o `sdr-ia-interpret` faz `fetch()` interno para 4 funcoes auxiliares:
- `sdr-message-parser` (parsing de contexto)
- `sdr-intent-classifier` (classificacao de intencao)
- `sdr-response-generator` (geracao de resposta)
- `sdr-action-executor` (execucao de acoes)

**Problema**: Cada chamada e um HTTP round-trip adicional (cold start + latencia de rede). Essas 4 funcoes NAO sao chamadas diretamente pelo frontend -- existem apenas como sub-etapas do orquestrador.

**Acao**: Converter de Edge Functions deployadas para **modulos locais** importados diretamente pelo `sdr-ia-interpret`:

```text
supabase/functions/sdr-ia-interpret/
  index.ts              (orquestrador -- ja existe)
  message-parser.ts     (extraido de sdr-message-parser/index.ts)
  intent-classifier.ts  (extraido de sdr-intent-classifier/index.ts)
  response-generator.ts (extraido de sdr-response-generator/index.ts)
  action-executor.ts    (extraido de sdr-action-executor/index.ts)
```

**Resultado**: 46 -> 42 funcoes. Elimina 4 cold starts por mensagem inbound. Latencia do pipeline SDR reduz ~400-800ms.

### Grupo B -- CS Micro-funcoes (6 funcoes para 2)

Funcoes CS pequenas (63-84 linhas cada) que poderiam ser agrupadas por padrao de invocacao:

**cs-ai-actions** (chamadas sob demanda pelo frontend):
- `cs-suggest-note` (84 linhas)
- `cs-churn-predictor` (chamada pontual)
- `cs-incident-detector` (chamada pontual)

**cs-scheduled-jobs** (CRON/batch):
- `cs-daily-briefing`
- `cs-nps-auto`
- `cs-renewal-alerts`
- `cs-trending-topics`

**Acao**: Consolidar usando roteamento por `action` no body:

```typescript
// cs-ai-actions/index.ts
const { action, ...params } = await req.json();
switch (action) {
  case 'suggest-note': return handleSuggestNote(params);
  case 'churn-predict': return handleChurnPredict(params);
  case 'detect-incidents': return handleDetectIncidents(params);
}
```

**Resultado**: 42 -> 37 funcoes. Menos deployments para manter.

### Funcoes que NAO devem ser consolidadas

| Funcao | Motivo para manter separada |
|--------|---------------------------|
| `sdr-ia-interpret` | Orquestrador principal, complexo |
| `cadence-runner` | CRON job critico, isolamento necessario |
| `sgt-webhook` | Webhook externo com auth propria |
| `bluechat-inbound` | Webhook externo com HMAC |
| `copilot-chat` | Streaming, contexto diferente |
| `deal-scoring` | Chamado independentemente |
| `whatsapp-send/email-send` | Integracao externa, reutilizados |
| `zadarma-*` | Integracao telefonia isolada |

---

## Parte 2: Documentacao de API Completa

A referencia atual (`api-reference.md`) lista apenas 19 das 46 funcoes. Faltam 27.

**Acao**: Atualizar `docs-site/docs/desenvolvedor/api-reference.md` com todas as funcoes, organizadas por categoria, incluindo:
- Endpoint e metodo
- Descricao
- Parametros de entrada (body JSON)
- Autenticacao necessaria (Bearer token, service_role, CRON_SECRET, HMAC)
- Exemplo de request/response

### Categorias a adicionar na documentacao

| Categoria | Funcoes faltantes |
|-----------|------------------|
| Amelia IA | `amelia-learn`, `amelia-mass-action`, `ai-benchmark` |
| Deals | `deal-loss-analysis`, `next-best-action`, `follow-up-scheduler` |
| CS | `cs-playbook-runner`, `cs-renewal-alerts`, `cs-trending-topics` |
| Integracao | `integration-health-check`, `tokeniza-offers`, `capture-form-submit` |
| Telefonia | `zadarma-proxy`, `zadarma-webhook`, `call-coach`, `call-transcribe` |
| SDR interno | `sdr-action-executor` (se mantida) |
| Aprendizado | `icp-learner`, `faq-auto-review` |
| Admin | `admin-create-user` |
| Webhooks | `bluechat-inbound` |
| SGT | `sgt-buscar-lead`, `sgt-sync-clientes` |
| Notificacao | `notify-closer`, `pipedrive-sync` |

---

## Resumo de Impacto

| Metrica | Antes | Depois |
|---------|-------|--------|
| Edge Functions deployadas | 46 | ~37 |
| Cold starts por msg SDR | 5 | 1 |
| Funcoes documentadas | 19/46 | 46/46 (ou 37/37 pos-consolidacao) |
| Latencia estimada SDR | ~2-3s | ~1-1.5s |

---

## Sequencia de Implementacao

1. **Grupo A** -- Internalizar 4 funcoes SDR como modulos locais do `sdr-ia-interpret`
2. **Grupo B** -- Consolidar 6 funcoes CS em 2
3. **Atualizar frontend** -- Ajustar chamadas que apontem para funcoes consolidadas
4. **Deletar funcoes antigas** -- Remover deployments obsoletos
5. **Atualizar docs** -- Reescrever `api-reference.md` com cobertura completa
6. **Testar** -- Validar fluxos SDR e CS end-to-end

---

## Secao Tecnica: Arquivos Impactados

### Novos arquivos
- `supabase/functions/sdr-ia-interpret/message-parser.ts`
- `supabase/functions/sdr-ia-interpret/intent-classifier.ts`
- `supabase/functions/sdr-ia-interpret/response-generator.ts`
- `supabase/functions/sdr-ia-interpret/action-executor.ts`
- `supabase/functions/cs-ai-actions/index.ts`
- `supabase/functions/cs-scheduled-jobs/index.ts`

### Arquivos editados
- `supabase/functions/sdr-ia-interpret/index.ts` (importar modulos locais em vez de fetch)
- `docs-site/docs/desenvolvedor/api-reference.md` (documentacao completa)
- Frontend: hooks/componentes que chamam funcoes CS consolidadas

### Funcoes a deletar (pos-consolidacao)
- `sdr-message-parser/`, `sdr-intent-classifier/`, `sdr-response-generator/`, `sdr-action-executor/`
- `cs-suggest-note/`, `cs-churn-predictor/`, `cs-incident-detector/`
- `cs-daily-briefing/`, `cs-nps-auto/`, `cs-renewal-alerts/`, `cs-trending-topics/`

