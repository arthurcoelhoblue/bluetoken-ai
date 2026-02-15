
# Roteamento Inteligente de Leads + Detecção de Duplicatas

## Status: ✅ Implementado

## Resumo

Plano unificado implementado com duas funcionalidades:
1. **Roteamento inteligente**: leads do SGT e Blue Chat vão para o pipeline e estágio corretos
2. **Detecção de duplicatas**: busca multi-critério (CPF, telefone, variações, email) antes de criar deal
3. **Blue Chat auto-criação de deal**: deals criados automaticamente quando lead entra pelo chat

## Arquivos alterados

- `supabase/functions/sgt-webhook/index.ts` — resolveTargetPipeline, findExistingDealForPerson, tipo_lead
- `supabase/functions/bluechat-inbound/index.ts` — mesmas funções + auto-criação de deal
