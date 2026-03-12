## Plano: Integração Stripe + Assinaturas + Controle de Usuários no Amélia CRM

### Status: ✅ Implementado

### Stripe Products
- **Amélia Full**: `prod_U6u9Sb7sDJQYlK` / `price_1T8gLHK6xO3NOXxi1JJp4yu6` — R$ 999/mês
- **Usuário Adicional**: `prod_U6uAtCGLZMClBx` / `price_1T8gMGK6xO3NOXxiVC9p676U` — R$ 180/mês

### Implementação

1. ✅ Secrets configurados (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
2. ✅ Tabela `subscriptions` criada com RLS
3. ✅ Edge Functions: `stripe-checkout`, `stripe-webhook`, `stripe-portal`, `check-subscription`
4. ✅ Hook `useSubscriptionLimits` para verificar limites
5. ✅ Página `/assinatura` para gerenciamento
6. ✅ Bloqueio de criação de usuário integrado no `CreateUserDialog`

### Webhook URL (configurar no Stripe Dashboard)
```
https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/stripe-webhook
```

Eventos necessários:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.paid`

---

## Plano: Garantir dados do formulário na Timeline + distinguir duplicados

### Status: ✅ Implementado

### Mudanças
1. **Backfill SQL** — Migração idempotente criou atividades `CRIACAO` com `origem=FORMULARIO` para 47 deals legados com `metadata.campos_extras`
2. **lp-lead-ingest hardening** — Captura explícita de erro no insert de `deal_activities`, com log estruturado
3. **Fallback frontend** — `DealTimelineTab` renderiza dados de `deal.metadata.campos_extras` quando não existe atividade `CRIACAO/FORMULARIO`
4. **Kanban melhorado** — Desempate por `created_at DESC` + horário de entrada visível no `DealCard`

### Arquivos impactados
- Migração SQL (backfill `deal_activities`)
- `supabase/functions/lp-lead-ingest/index.ts`
- `src/components/deals/DealTimelineTab.tsx`
- `src/hooks/deals/useDealQueries.ts`
- `src/components/pipeline/DealCard.tsx`

---

## Plano: Push de leads para Mautic e SGT em tempo real

### Status: ✅ Implementado

### Resumo
Após criar contato + deal no `lp-lead-ingest`, o lead é enviado para Mautic (API REST, Basic Auth) e SGT (`criar-lead-api`) em paralelo, fire-and-forget.

### Secrets configurados
- `MAUTIC_URL`, `MAUTIC_USERNAME`, `MAUTIC_PASSWORD`
- `SGT_WEBHOOK_SECRET` (já existia)

### Implementação
- `pushToMautic(lead)` — POST `/api/contacts/new` com Basic Auth, mapeia firstname/lastname/email/phone/tags/UTMs
- `pushToSGT(lead, empresa)` — POST `criar-lead-api` com x-api-key, mapeia nome_lead/email/telefone/origem_canal/UTMs
- Ambos executam via `Promise.allSettled()` — não bloqueiam e não falham o fluxo principal
- Resultado inclui `mautic_status` e `sgt_status` por lead

### Arquivos impactados
- `supabase/functions/lp-lead-ingest/index.ts`

---

## Plano: Módulo Playbook de Vendas

### Status: 🔧 Em implementação — Fase 1 concluída

### Fase 1 — Fundação ✅
- 4 enums: `playbook_step_tipo`, `playbook_executor`, `playbook_run_status`, `playbook_evento_tipo`
- 4 tabelas: `playbooks`, `playbook_steps`, `deal_playbook_runs`, `deal_playbook_events`
- RLS com `has_role()` e `get_user_empresas()`
- Trigger: `deal_playbook_events → deal_activities` (timeline automática)
- Trigger: playbook ATIVA → pausa cadências do deal automaticamente
- 3 views de performance: `v_playbook_stats`, `v_playbook_step_performance`, `v_playbook_vendedor_aderencia`
- Tipos TypeScript: `src/types/playbook.ts`

### Fase 2 — Motor de Execução (próximo)
- Edge Function `playbook-runner` (CRON 5min)
- Hooks: `usePlaybookRuns`, `usePlaybookEvents`
- Interop cadência × playbook no `cadence-runner`

### Fase 3 — UI (futuro)
- Página `/playbooks`, Editor drag-and-drop, Timeline no Deal, Badge no Kanban

### Fase 4 — Meu Dia + Notificações + Gamificação (futuro)

### Fase 5 — IA Avançada (futuro)
- 5.1: Sugestão + Scripts dinâmicos
- 5.2: Adaptação + Análise
