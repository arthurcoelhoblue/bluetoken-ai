

# Plano Unificado: Limpeza + API Tokeniza Gov + Sync Amélia

## Passo 1 — Limpeza ✅ CONCLUÍDO
Todas as tabelas já foram limpas: `cs_contracts`, `cs_customers`, `lead_contacts`, `contacts` = 0 registros.

## Passo 2 — Criar Edge Function `investor-export` no Tokeniza Gov

Nova edge function no projeto `gov-key-keeper` que lê `investors`, `subscriptions`, `positions` e `deals` do banco local e retorna JSON consolidado.

**Endpoint**: `POST /investor-export`  
**Segurança**: Header `x-api-key` validado contra secret `EXPORT_API_KEY`

**Payload de resposta**:
```json
{
  "investors": [
    {
      "external_id": "uuid",
      "full_name": "...",
      "email": "...",
      "phone": "...",
      "document": "CPF/CNPJ",
      "person_type": "pf|pj",
      "kyc_status": "approved|pending|...",
      "suitability": "conservative|moderate|...",
      "is_active": true,
      "positions": [
        {
          "deal_name": "CRI XPTO",
          "invested_amount": 50000,
          "current_value": 52000,
          "subscribed_at": "2025-03-15T10:00:00Z",
          "status": "confirmed",
          "is_active": true
        }
      ]
    }
  ],
  "total": 7000,
  "exported_at": "2026-02-28T..."
}
```

**Secret no Tokeniza Gov**: `EXPORT_API_KEY` (chave que inventaremos)

**Config**: Adicionar `[functions.investor-export] verify_jwt = false` no `config.toml` do Tokeniza Gov

## Passo 3 — Criar Edge Function `tokeniza-gov-sync` na Amélia

Consome a API do Passo 2 e popula `contacts`, `cs_customers` e `cs_contracts`.

**Mapeamento completo**:
```text
Tokeniza Gov                        → Amélia
────────────────────────────────────────────────────────
investors.full_name                  → contacts.nome
investors.document                   → contacts.cpf
investors.email                      → contacts.email
investors.phone                      → contacts.telefone
investors.kyc_status                 → contacts.notas
investors.suitability                → contacts.tags

Com posições ativas                  → is_cliente=true, tag 'investidor-ativo'
Sem posições                         → is_cliente=false, tag 'cadastrado-sem-investimento'

positions.deal_name                  → cs_contracts.plano / oferta_nome
subscriptions.subscribed_at          → cs_contracts.data_contratacao
subscriptions.amount                 → cs_contracts.valor
subscriptions.status                 → cs_contracts.status (ATIVO/PENDENTE/CANCELADO)
```

**Secrets na Amélia** (2):
- `TOKENIZA_GOV_API_URL` = `https://poksiicnojklsnjgiklk.supabase.co/functions/v1/investor-export`
- `TOKENIZA_GOV_API_KEY` = mesma chave do Passo 2

**Config**: Adicionar `[functions.tokeniza-gov-sync] verify_jwt = false` no `config.toml` da Amélia

## Passo 4 — Cadastrar Secrets e Executar

1. Cadastrar `EXPORT_API_KEY` no Tokeniza Gov
2. Cadastrar `TOKENIZA_GOV_API_URL` e `TOKENIZA_GOV_API_KEY` na Amélia
3. Deploy das duas functions
4. Executar primeira sync

## Resumo de Alterações

| Projeto | Alteração |
|---------|-----------|
| Tokeniza Gov | Nova edge function `investor-export` + config.toml + 1 secret |
| Amélia | Nova edge function `tokeniza-gov-sync` + config.toml + 2 secrets |

Nenhuma alteração de schema em nenhum dos dois projetos.

