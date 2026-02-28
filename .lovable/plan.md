

# Plano: Limpeza de Dados + Integração Amélia ↔ Tokeniza Gov

## Fase 1 — Limpeza do Banco (SQL direto)

Deletar em cascata respeitando foreign keys, na ordem:

1. `deal_stage_history`, `deal_activities`, `deal_cadence_runs` (dependem de deals)
2. `deals` (todas)
3. `lead_cadence_events`, `lead_cadence_runs`, `lead_message_intents`, `lead_messages`, `lead_conversation_state`, `lead_classifications`, `lead_contact_issues` (dependem de leads)
4. `cs_health_log`, `cs_surveys`, `cs_incidents`, `cs_playbook_runs` (dependem de cs_customers)
5. `cs_contracts` (todas)
6. `cs_customers` (todas)
7. `sgt_event_logs`, `sgt_events` (histórico SGT)
8. `lead_contacts` (todas)
9. `contacts` (todas — TOKENIZA e BLUE)
10. `notifications`, `copilot_messages`, `copilot_insights`, `seller_points_log`, `seller_badge_awards` (dados operacionais antigos)

**Preservados**: `profiles`, `empresas`, `pipelines`, `pipeline_stages`, `cadences`, `cadence_steps`, `message_templates`, `product_knowledge`, `knowledge_*`, `comissao_regras`, `organizations`, `user_access_assignments`.

---

## Fase 2 — Edge Function `tokeniza-gov-sync` na Amélia

Uma nova edge function na Amélia que conecta diretamente ao banco do [Tokeniza Gov](/projects/f8d2848a-cdde-44c2-8a72-46b4113f9a87) (projeto `poksiicnojklsnjgiklk`) para ler investidores e posições já sincronizados lá.

### Credenciais necessárias (secrets na Amélia)
- `TOKENIZA_GOV_SUPABASE_URL` = `https://poksiicnojklsnjgiklk.supabase.co`
- `TOKENIZA_GOV_SERVICE_ROLE_KEY` = service role key do projeto Tokeniza Gov

### Fluxo
1. Conectar ao banco do Tokeniza Gov via `createClient(URL, SERVICE_KEY)`
2. Ler `investors` (full_name, email, phone, document, person_type, kyc_status, suitability, is_active)
3. Ler `positions` com JOIN em `deals` (investor_id, deal_id → deal.name, invested_amount, current_value, is_active)
4. Para cada investidor:
   - Criar/atualizar `contacts` na Amélia com `empresa=TOKENIZA`, `canal_origem=TOKENIZA_GOV`, `cpf=document`
   - Se tem posições ativas → `is_cliente=true`, `tags=['investidor-ativo', 'tokeniza-investidor']`
   - Se NÃO tem posições → `is_cliente=false`, `tags=['cadastrado-sem-investimento', 'tokeniza-cadastro']`
   - Upsert por `cpf` para evitar duplicatas
5. Para cada investidor com `is_cliente=true`:
   - Criar `cs_customers` vinculado ao contact
   - Criar `cs_contracts` para cada posição (nome da oferta, valor investido, status)
6. Para investidores sem investimento:
   - Criar `cs_customers` com `is_active=false`, `tags=['sem-investimento']`

### Deduplicação
Upsert em `contacts` usando `cpf` como chave única (campo já existente). Se não houver CPF, usar `email`.

---

## Fase 3 — Refatorar SGT para Sync Bidirecional Diário

Criar `daily-bidirectional-sync` que roda às 5h BRT (8h UTC):

**SGT → Amélia**: enriquecer contacts existentes com dados do SGT (scores, UTMs, dados Mautic/LinkedIn) — sem criar novos registros.

**Amélia → SGT**: enviar classificações ICP, temperatura comercial, status de cadência para o SGT.

---

## Fase 4 — CRON Jobs

Agendar via `pg_cron`:
- `tokeniza-gov-sync` diário às 5h BRT
- `daily-bidirectional-sync` diário às 5h15 BRT (logo após, para enriquecer os dados recém-importados)

---

## Detalhes Técnicos

### Mapeamento Tokeniza Gov → Amélia

```text
investors.full_name     → contacts.nome
investors.email         → contacts.email
investors.phone         → contacts.telefone
investors.document      → contacts.cpf
investors.kyc_status    → contacts.notas (campo informativo)
investors.suitability   → contacts.tags (ex: 'perfil-conservador')
positions.invested_amount → cs_contracts.valor
positions.deal.name      → cs_contracts.plano (nome da oferta)
positions.is_active      → cs_contracts.status (ATIVO/CANCELADO)
```

### Tabelas Tokeniza Gov consultadas
- `investors` (~7.000 registros)
- `positions` (investimentos agrupados por investor+deal)
- `deals` (ofertas/projetos — para obter nome da oferta)

### Nenhuma alteração de schema necessária
As colunas `is_cliente`, `tags`, `cpf` já existem em `contacts`. Os campos de `cs_customers` e `cs_contracts` atendem o mapeamento.

### Ordem de execução
1. Executar limpeza do banco (Fase 1)
2. Cadastrar secrets `TOKENIZA_GOV_SUPABASE_URL` e `TOKENIZA_GOV_SERVICE_ROLE_KEY`
3. Criar e deployar `tokeniza-gov-sync`
4. Executar primeira sync manualmente
5. Agendar CRON jobs

