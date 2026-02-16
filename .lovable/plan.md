

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

## Fase A — Validacao Centralizada de Env Vars (Ponto 2 - Alto)

**Problema**: 468 chamadas `Deno.env.get()` espalhadas em 46 edge functions, muitas usando `!` (non-null assertion) sem validacao. Se uma variavel essencial estiver faltando, a funcao quebra de forma imprevisivel em runtime.

**Acao**: Criar `supabase/functions/_shared/config.ts` que:
- Le e valida as variaveis essenciais (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) na inicializacao
- Exporta um objeto tipado `envConfig`
- Lanca erro claro e imediato se uma variavel obrigatoria estiver ausente
- Variaveis opcionais (ex: `OPENAI_API_KEY`, `PIPEDRIVE_API_TOKEN`) sao expostas via funcoes que retornam `string | null`

**Arquivos**:
- Criar: `supabase/functions/_shared/config.ts`
- Editar: As 46 edge functions para importar de `config.ts` em vez de chamar `Deno.env.get()` diretamente

**Escopo realista para esta iteracao**: Aplicar em todas as edge functions, priorizando as 3 publicas (sgt-webhook, bluechat-inbound, whatsapp-inbound) e as mais criticas (cadence-runner, sdr-action-executor, email-send, whatsapp-send).

---

## Fase B — Eliminacao de `any` Explicito (Ponto 1 - Critico, parte pratica)

**Problema**: 145 ocorrencias de `: any` explicitamente no codigo (594 no backend, ~180 no frontend por grep). Isso anula beneficios do TypeScript.

**Acao**: Substituir `: any` por tipos especificos ou `unknown` com narrowing.

**Abordagem por camada**:

1. **Backend (edge functions)** — Foco nos arquivos com mais ocorrencias:
   - `revenue-forecast/index.ts` — criar interfaces para deal features e AI response
   - `next-best-action/index.ts` — tipar os maps de contexto
   - `amelia-learn/index.ts` — tipar learnings array e AI args
   - Demais funcoes: substituir `: any` por tipos inline ou `unknown`

2. **Frontend** — Foco nos arquivos identificados:
   - `AmeliaMassActionPage.tsx` (~25 ocorrencias) — tipar deal com a interface existente
   - `ContactDetailSheet.tsx`, `useLeadIntents.ts`, `useDealDetail.ts`, `useZadarma.ts` — usar tipos do Supabase types

**Nota**: Nao ativaremos `noImplicitAny: true` no tsconfig nesta iteracao. Isso quebraria centenas de pontos implicitos e e melhor feito apos eliminar os explicitos. A auditoria sera informada que o `any` explicito foi eliminado como primeiro passo.

---

## Fase C — Adocao Global do Logger Estruturado (Ponto 3 - Alto)

**Problema**: 396 `console.log/warn/error` espalhados. O `_shared/logger.ts` existe mas nao e usado globalmente.

**Acao**:
1. Evoluir `_shared/logger.ts` para incluir contexto estruturado (function_name, request_id)
2. Substituir `console.log/warn/error` por `logger.info/warn/error` nas edge functions mais criticas
3. Manter `console.*` no frontend (logs de browser sao diferentes de logs de servidor)

**Escopo**: Aplicar nas mesmas edge functions priorizadas na Fase A.

---

## Fase D — Reducao de Complexidade dos Arquivos Maiores (Ponto 4 - Medio)

**Problema**: `sgt-webhook` tem 2.043 linhas e complexidade ciclomatica >170. `bluechat-inbound` tem 1.505 linhas.

**Acao**: Extrair modulos de cada funcao sem mudar comportamento.

Para `sgt-webhook`:
- Extrair `sgt-webhook/validation.ts` (schemas Zod + validatePayload)
- Extrair `sgt-webhook/normalization.ts` (normalizePayloadFormat + normalizeSGTEvent)
- Extrair `sgt-webhook/classification.ts` (classificarLead + helpers ICP)
- Extrair `sgt-webhook/cadence.ts` (startCadence + helpers)
- `index.ts` fica como orquestrador (~200 linhas)

Para `bluechat-inbound`:
- Extrair `bluechat-inbound/schemas.ts`
- Extrair `bluechat-inbound/contact-resolver.ts`
- Extrair `bluechat-inbound/conversation-handler.ts`

---

## Fora de Escopo (Prioridade 2-3 do relatorio)

Os seguintes itens ficam para iteracoes futuras:
- Ativar `strict: true` / `noImplicitAny: true` no tsconfig (requer correcao de centenas de pontos implicitos)
- Aumentar cobertura de testes de integracao
- Refatorar `sidebar.tsx` e `ConversationView.tsx` (frontend, menor impacto)
- Configurar ESLint com `no-explicit-any`
- Integrar logger com servico externo (Logtail/Sentry)

---

## Sequencia de Execucao

| Ordem | Fase | Impacto | Risco |
|---|---|---|---|
| 1 | A — Config centralizado | Alto (robustez) | Baixo |
| 2 | B — Eliminar `any` | Alto (qualidade) | Medio |
| 3 | C — Logger estruturado | Medio (operacao) | Baixo |
| 4 | D — Quebrar arquivos | Medio (manutencao) | Baixo |

