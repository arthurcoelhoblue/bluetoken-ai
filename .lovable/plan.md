# Plano de Ação - Auditoria BlueToken AI

## Status Geral

| Fase | Status |
|------|--------|
| Fase 1 - Segurança | ✅ Concluída |
| Fase 2 - Qualidade | ✅ Concluída |
| Fase 3 - Testes + Performance | 🔲 Pendente |
| Fase 4 - Documentação | ✅ Concluída |

---

## Fase 1 - Concluída

- ✅ 1.1 Validação Zod nos webhooks públicos (bluechat-inbound, whatsapp-inbound, capture-form-submit, sgt-webhook, zadarma-webhook)
- ✅ 1.3 CORS restritivo com whitelist em `_shared/cors.ts`, aplicado em todas as 46 Edge Functions
- 🔲 1.2 Rate limiting (baixa prioridade, a implementar na Fase 3)

## Fase 2 - Concluída

- ✅ 2.1 Eliminado `any` em 11 hooks críticos (useContactsPage, useCSCustomers, useAutoRules, useCaptureForms, useImportacao, useNotifications, usePipelines, usePipelineConfig, useAccessControl, useCopilotMessages, useOrphanDeals)
- ✅ 2.2 Quebrado `useDeals.ts` em `deals/useDealQueries.ts` + `deals/useDealMutations.ts` com barrel re-export
- 🔲 2.3 Quebrar Edge Functions grandes (sgt-webhook, bluechat-inbound, cadence-runner)
- 🔲 2.4 Quebrar componentes grandes (DealDetailSheet, sidebar, ConversationView)

## Fase 3 - Pendente

- 🔲 3.1 Testes para fluxos críticos (Auth, SDR IA, Cadence, Deal scoring)
- 🔲 3.2 Paginação nas listas (Leads, Contacts, Organizations, CS Customers)
- 🔲 3.3 Otimizar queries N+1

## Fase 4 - Concluída

- ✅ 4.1 README.md reescrito com arquitetura real
- ✅ 4.2 Versionamento atualizado para 1.0.0
- 🔲 4.3 Logger estruturado nas Edge Functions

---

## Próximos passos

1. Quebrar Edge Functions grandes (2.3)
2. Quebrar componentes grandes (2.4)
3. Adicionar testes unitários (3.1)
4. Implementar rate limiting (1.2)
5. Logger estruturado (4.3)
