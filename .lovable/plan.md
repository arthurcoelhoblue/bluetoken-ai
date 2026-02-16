# Fase G — Rumo ao 11/10 (Excelencia de Engenharia)

O relatorio de conclusao da Fase F confirma nota 9.0/10 e define 5 pilares para atingir "Referencia de Industria". Este plano implementa os 3 de maior impacto imediato, conforme recomendacao do proprio relatorio.

---

## Escopo da Fase G

Baseado nas 3 prioridades recomendadas pelo relatorio:

1. Padronizacao total de logging (eliminar os ~60 console.* restantes em 4 Edge Functions)
2. Refatoracao do useCadences.ts (753 linhas -> modulos menores)
3. ESLint reforçado (prevenir regressoes de qualidade)

---

## G1 — Logging 100% Padronizado (4 Edge Functions restantes)

A Fase F padronizou o sgt-webhook. Restam 4 funcoes com console.* direto:


| Funcao                        | console.* | Acao                                                |
| ----------------------------- | --------- | --------------------------------------------------- |
| `whatsapp-inbound/index.ts`   | ~25       | Substituir por `createLogger('whatsapp-inbound')`   |
| `cadence-runner/index.ts`     | ~25       | Substituir por `createLogger('cadence-runner')`     |
| `copilot-chat/index.ts`       | ~5        | Substituir por `createLogger('copilot-chat')`       |
| `cs-playbook-runner/index.ts` | ~6        | Substituir por `createLogger('cs-playbook-runner')` |


Cada `console.log('[Tag] msg')` vira `log.info('msg', { dados })` — transformacao mecanica, sem mudanca de logica.

**Resultado**: 0 console.* diretos em Edge Functions. 100% usando createLogger.

---

## G2 — Refatorar useCadences.ts (753 linhas -> ~4 modulos)

O arquivo mais longo do projeto. Sera dividido preservando a API publica (zero breaking changes):


| Novo Arquivo                                | Conteudo                                                | ~Linhas |
| ------------------------------------------- | ------------------------------------------------------- | ------- |
| `src/hooks/cadences/useCadences.ts`         | `useCadences()`, `useCadence()`                         | ~140    |
| `src/hooks/cadences/useCadenceRuns.ts`      | `useCadenceRuns()`, `useCadenceRunDetail()`             | ~200    |
| `src/hooks/cadences/useCadenceEvents.ts`    | `useCadenceEvents()`, `useCadenceNextActions()`         | ~200    |
| `src/hooks/cadences/useCadenceMutations.ts` | `useUpdateCadenceRunStatus()`, stage triggers, CRM view | ~120    |
| `src/hooks/cadences/index.ts`               | Re-exporta tudo (barrel file)                           | ~10     |
| `src/hooks/useCadences.ts`                  | Re-exporta de `./cadences` (backward compat)            | ~3      |


Nenhuma pagina ou componente precisa mudar seus imports.

---

## G3 — ESLint Reforçado

Adicionar regras que previnem regressao de qualidade:

```javascript
// Regras a adicionar ao eslint.config.js
"no-console": ["warn", { allow: ["warn", "error"] }], // Frontend only
"@typescript-eslint/no-explicit-any": "error",
"@typescript-eslint/consistent-type-imports": "warn",
```

A regra `no-console` so se aplica a arquivos `src/` (frontend). Os arquivos de Edge Functions usam createLogger que internamente chama console.*, entao nao sao afetados.

---

## G4 — Limpeza de console.* no Frontend (11 arquivos)

Substituir os ~16 `console.error/warn` restantes no frontend por tratamento adequado:


| Arquivo                   | Instancias | Acao                                     |
| ------------------------- | ---------- | ---------------------------------------- |
| `ErrorBoundary.tsx`       | 1          | Manter (padrao React)                    |
| `AuthContext.tsx`         | 3          | Manter (debug critico de auth)           |
| `NotFound.tsx`            | 1          | Manter (debug de rotas 404)              |
| `CoachingSidebar.tsx`     | 1          | Remover (erro ja tratado com setState)   |
| `EmailFromDealDialog.tsx` | 1          | Remover (toast ja exibe erro)            |
| `DealCard.tsx`            | 1          | Remover (catch silencioso)               |
| `useCopilotInsights.ts`   | 3          | Remover (erros ja tratados com setState) |
| `useCopilotMessages.ts`   | 3          | Remover (erros ja tratados com setState) |
| `useKnowledgeFaq.ts`      | 1          | Remover (fallback ja retorna valor)      |
| `CopilotPanel.tsx`        | 1          | Remover (toast ja exibe erro)            |
| `CSPesquisasPage.tsx`     | 1          | Remover (toast ja exibe erro)            |


**Resultado**: Apenas 5 console.* intencionais permanecem (ErrorBoundary, AuthContext, NotFound) — todos justificados.

---

## Sequencia de Execucao

1. G1 — Padronizar logging nas 4 Edge Functions restantes
2. G2 — Refatorar useCadences.ts em modulos
3. G3 — Reforcar ESLint com regras de qualidade
4. G4 — Limpar console.* desnecessarios no frontend
5. Redeploy das 4 Edge Functions modificadas
6. Rodar testes para garantir 314/314 passando

## Resultado Esperado

- Logging: 100% padronizado (createLogger) em TODAS Edge Functions
- Maior arquivo: reduzido de 753 para ~200 linhas max
- ESLint: previne regressoes de any, console.log e imports
- Frontend: apenas 5 console.* intencionais e documentados
- Scorecard projetado: Qualidade 9->10, Manutenibilidade 9->10