

# Plano: Expansão 4 Empresas (Blue, Tokeniza, MPuppe, Axia)

O diff contém ~1457 linhas de alterações em ~35 arquivos. As mudanças dividem-se em 4 categorias:

## 1. Tipos e Classificação (`src/types/classification.ts`)
- Expandir `IcpMpuppe` com 5 ICPs reais: `MPUPPE_FINTECH_REG`, `MPUPPE_DATA_HEAVY`, `MPUPPE_AI_PIONEER`, `MPUPPE_LEGAL_DEPT`, `MPUPPE_NAO_CLASSIFICADO`
- Expandir `IcpAxia` com 5 ICPs: `AXIA_FINTECH_LAUNCH`, `AXIA_EXCHANGE_BUILDER`, `AXIA_ASSET_TOKENIZER`, `AXIA_MARKETPLACE_PAY`, `AXIA_NAO_CLASSIFICADO`
- Adicionar tipos `PersonaMpuppe` e `PersonaAxia` com 3 personas cada
- Expandir `ICP_LABELS`, `PERSONA_LABELS` com labels para os novos ICPs/Personas
- Renomear labels existentes (ex: "Investidor Serial" → "Investidor Recorrente")
- Adicionar arrays `ICPS_MPUPPE`, `ICPS_AXIA`, `PERSONAS_MPUPPE`, `PERSONAS_AXIA`

## 2. Type casts em ~25 arquivos frontend
Substituir `'BLUE' | 'TOKENIZA'` por `'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA'` nos type casts de todos os hooks e componentes listados no diff.

Arquivos afetados:
- `src/components/contacts/ContactCreateDialog.tsx`
- `src/components/conversas/ConversationTakeoverBar.tsx`
- `src/components/conversas/ManualMessageInput.tsx`
- `src/components/cs/CSCustomerCreateDialog.tsx`
- `src/components/cs/SGTSyncDialog.tsx`
- `src/components/deals/DealDetailSheet.tsx`
- `src/components/leads/EditClassificationModal.tsx`
- `src/components/organizations/OrgCreateDialog.tsx`
- `src/components/pipeline/CreateDealDialog.tsx`
- `src/components/pipeline/QuickCreateContactDialog.tsx`
- `src/components/settings/UserAccessList.tsx`
- `src/hooks/useAtendimentos.ts`
- `src/hooks/useCSContracts.ts`
- `src/hooks/useCSCustomers.ts`
- `src/hooks/useCadenceRunsWithPendingActions.ts`
- `src/hooks/useCadenciasCRM.ts`
- `src/hooks/useContactDuplicateCheck.ts`
- `src/hooks/useContactLeadBridge.ts`
- `src/hooks/useContacts.ts`
- `src/hooks/useConversationMode.ts`
- `src/hooks/useConversationState.ts`
- `src/hooks/useLeadClassification.ts`
- `src/hooks/useLeadContactIssues.ts`
- `src/hooks/useLeadDetail.ts`
- `src/hooks/useLeadsWithPendingActions.ts`
- `src/hooks/usePessoaContext.ts`
- `src/hooks/usePipelineConfig.ts`
- `src/hooks/useProductKnowledge.ts`
- `src/hooks/useSgtEvents.ts`
- `src/hooks/useTemplates.ts`
- `src/pages/AmeliaMassActionPage.tsx`
- `src/pages/CustomFieldsConfigPage.tsx`
- `src/lib/sdr-logic.ts`
- `src/types/contactsPage.ts`, `conversation.ts`, `customFields.ts`, `deal.ts`, `pessoa.ts`, `settings.ts`, `sgt.ts`

## 3. Testes (`src/contexts/CompanyContext.test.tsx`, `src/hooks/__tests__/useLeadClassification.test.ts`)
- Wrap test renders com `QueryClientProvider`
- Remover assertion de label hardcoded
- Adicionar testes para ICPs/Personas de MPuppe e Axia

## 4. Edge Functions (SDR-IA)

### `intent-classifier.ts`
- Expandir `EmpresaTipo` com MPuppe/Axia
- `computeClassificationUpgrade`: ICP default por empresa (4 empresas)
- `decidirProximaPergunta`: lógica de framework por empresa (Blue=SPIN, MPuppe=BANT, Axia=GPCT+BANT, Tokeniza=GPCT)
- `detectCrossCompanyInterest`: cross-sell 4x4 com mapa de keywords
- Adicionar `EMPRESA_IDENTIDADE` (identidade IA por empresa)
- Atualizar `SYSTEM_PROMPT` com descrição multi-vertical e detecção DISC
- Injetar identidade no prompt ativo antes de enviar à IA
- Mudar `if/else` do pricing para `else if` chain com MPUPPE/AXIA via product_knowledge

### `response-generator.ts`
- Expandir `empresaDesc` para 4 empresas
- Adicionar regras críticas para MPuppe (sem preço fixo, agendar com Dr. Rodrigo)
- Adicionar regras críticas para Axia (R$ 14.900/mês primeiro módulo, agendar demo técnica)

## 5. Migration necessária (não incluída no diff)
Os novos ICPs precisam ser adicionados ao enum `icp_tipo` no banco. Verificar se já existem — o `types.ts` no diff sugere que `MPUPPE_NAO_CLASSIFICADO` e `AXIA_NAO_CLASSIFICADO` já existem, mas os novos valores (`MPUPPE_FINTECH_REG`, etc.) precisam de migration.

## Notas técnicas
- O diff tem duplicatas redundantes em alguns tipos (`'MPUPPE' | 'AXIA' | 'MPUPPE' | 'AXIA'`) — serão corrigidos para `'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA'`
- `src/integrations/supabase/types.ts` NÃO pode ser editado manualmente — será atualizado pela migration
- O `useContactDuplicateCheck.ts` no diff tem duplicata no tipo — corrigiremos

