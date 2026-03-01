

# Refatorar sgt-webhook para apenas enriquecimento

## O que será removido (linhas 365-600)

1. **Auto-criação de deal** (linhas 365-584): busca de contact, detecção de duplicata, routing de pipeline, round-robin de vendedor, insert em `deals`, criação de `deal_activities`, notificações de deal prioritário, cadência de aquecimento
2. **Cadências do SGT** (linhas 586-600): `decidirCadenciaParaLead`, `iniciarCadenciaParaLead`
3. **Imports não mais necessários**: `resolveTargetPipeline`, `findExistingDealForPerson`, `decidirCadenciaParaLead`, `iniciarCadenciaParaLead`, `isRenewalLead`, `TipoLead`

## O que permanece (linhas 1-364)

- Validação, autenticação, rate limiting, idempotência
- Insert em `sgt_events` + `sgt_event_logs`
- Normalização do lead
- Upsert em `lead_contacts` com dados enriquecidos (LinkedIn, Mautic, Chatwoot)
- Sanitização de telefone/email
- Upsert de pessoa global
- Auto-criação/merge de contact CRM (sem deal)
- Registro de issues de contato
- Descarte de leads inválidos
- Verificação de modo MANUAL
- Criação de `lead_conversation_state`
- Classificação do lead (ICP, temperatura) — mantida para enriquecimento

## Resposta simplificada

A resposta JSON será simplificada: retorna `classification` mas sem `cadence` e sem informações de deal.

## Arquivo

- `supabase/functions/sgt-webhook/index.ts` — remover bloco de deal+cadência, limpar imports, simplificar resposta

