

# Plano de Acao — Auditoria v2: Rumo a v1.0 Estavel

## Resumo do Diagnostico

A auditoria v2 da Manus AI elevou a nota geral de **6.5 para 7.5/10**, reconhecendo as melhorias em seguranca e arquitetura. Quatro pontos remanescentes foram identificados, organizados por prioridade.

## Scorecard Atual

| Categoria | Antes | Agora | Meta v1.0 |
|---|---|---|---|
| Qualidade de Codigo | 6 | 7 | 9 |
| Seguranca | 5 | 8 | 9 |
| Cobertura de Testes | 2 | 3 | 6 |
| Arquitetura | 7 | 8 | 9 |
| **Geral** | **6.5** | **7.5** | **8.5+** |

---

## Fase A — Validacao Centralizada de Env Vars ✅ PARCIAL (7/46 funções)

**Criado**: `supabase/functions/_shared/config.ts`
- `envConfig` com SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY validados
- `getOptionalEnv()` e `getOptionalEnvWithDefault()` para vars opcionais
- `createServiceClient()` factory para Supabase admin client

**Migrado (7 funções prioritárias)**:
- ✅ email-send
- ✅ whatsapp-send
- ✅ cadence-runner
- ✅ sdr-action-executor
- ✅ cs-trending-topics
- ✅ sgt-webhook (imports + createClient principal)
- ✅ bluechat-inbound (imports)
- ✅ whatsapp-inbound (imports + createClient + secret calls)

**Pendente**: Restantes ~39 edge functions (deal-scoring, ai-benchmark, cs-*, etc.)

---

## Fase B — Eliminacao de `any` Explicito ✅ PARCIAL (sdr-action-executor)

**Migrado**:
- ✅ sdr-action-executor — eliminados ~10 `: any` com Record<string, unknown> e tipos inline

**Pendente**: revenue-forecast, next-best-action, amelia-learn, AmeliaMassActionPage.tsx, etc.

---

## Fase C — Adocao Global do Logger Estruturado ✅ PARCIAL (5 funções)

**Logger adotado em**:
- ✅ email-send (todos console.* → log.info/warn/error)
- ✅ whatsapp-send (todos console.* → log.*)
- ✅ cadence-runner (auth + main handler)
- ✅ sdr-action-executor (todos console.* → log.*)
- ✅ cs-trending-topics (console.error → log.error)

**Pendente**: sgt-webhook, bluechat-inbound (imports adicionados mas console.* internos não migrados), restantes

---

## Fase D — Reducao de Complexidade dos Arquivos Maiores 🔜 NÃO INICIADO

Para `sgt-webhook` (2.077 linhas):
- Extrair `sgt-webhook/validation.ts`
- Extrair `sgt-webhook/normalization.ts`
- Extrair `sgt-webhook/classification.ts`
- Extrair `sgt-webhook/cadence.ts`

Para `bluechat-inbound` (1.505 linhas):
- Extrair `bluechat-inbound/schemas.ts`
- Extrair `bluechat-inbound/contact-resolver.ts`
- Extrair `bluechat-inbound/conversation-handler.ts`

---

## Fora de Escopo (Prioridade 2-3 do relatorio)

- Ativar `strict: true` / `noImplicitAny: true` no tsconfig
- Aumentar cobertura de testes de integracao
- Refatorar `sidebar.tsx` e `ConversationView.tsx`
- Configurar ESLint com `no-explicit-any`
- Integrar logger com servico externo (Logtail/Sentry)

---

## Sequencia de Execucao

| Ordem | Fase | Status | Progresso |
|---|---|---|---|
| 1 | A — Config centralizado | ✅ Parcial | 7/46 funções |
| 2 | B — Eliminar `any` | ✅ Parcial | 1 função backend |
| 3 | C — Logger estruturado | ✅ Parcial | 5 funções |
| 4 | D — Quebrar arquivos | 🔜 Pendente | 0% |
