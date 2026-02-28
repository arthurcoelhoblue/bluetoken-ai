

# Plano: Limpeza de Contacts/Deals + Sync Tokeniza Gov

## Estado Atual do Banco

| Tabela | Registros | Ação |
|--------|-----------|------|
| deals | 0 | ✅ já limpo |
| deal_activities | 0 | ✅ já limpo |
| deal_stage_history | 0 | ✅ já limpo |
| cs_contracts | 2.055 | 🗑 deletar |
| cs_customers | 971 | 🗑 deletar |
| lead_contacts | 9.996 | 🗑 deletar |
| contacts | 8.054 | 🗑 deletar |

## Passo 1 — Limpeza (SQL direto, respeitando FKs)

Ordem de execução:
1. `DELETE FROM cs_contracts` (depende de cs_customers)
2. `DELETE FROM cs_customers` (depende de contacts)
3. `DELETE FROM lead_contacts` (depende de contacts via trigger)
4. `DELETE FROM contacts`

Tudo o mais (pipelines, knowledge base, cadences, templates, profiles, notifications, copilot) **permanece intacto**.

## Passo 2 — Cadastrar Secrets do Tokeniza Gov

Adicionar na Amélia:
- `TOKENIZA_GOV_SUPABASE_URL` = URL do projeto Tokeniza Gov
- `TOKENIZA_GOV_SERVICE_ROLE_KEY` = service role key do Tokeniza Gov

## Passo 3 — Criar Edge Function `tokeniza-gov-sync`

Conecta ao banco do Tokeniza Gov, lê `investors` + `positions` + `deals`, e popula:
- `contacts` (upsert por CPF, empresa=TOKENIZA)
- `cs_customers` (vinculado ao contact)
- `cs_contracts` (uma por posição/investimento)

Flag de separação:
- Com investimentos → `is_cliente=true`, tag `investidor-ativo`
- Sem investimentos → `is_cliente=false`, tag `cadastrado-sem-investimento`

## Passo 4 — Configurar no `config.toml` e executar primeira sync

