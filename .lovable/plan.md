

# Cadastrar secrets e testar integração Tokeniza Gov ↔ Amélia

## Status atual
- **Tokeniza Gov**: ✅ `investor-export` criada, `EXPORT_API_KEY` cadastrado, `config.toml` atualizado
- **Amélia**: ✅ `tokeniza-gov-sync` criada, `config.toml` atualizado
- **Pendente**: Cadastrar 2 secrets na Amélia

## Passo 1 — Cadastrar secrets na Amélia

| Secret | Valor |
|--------|-------|
| `TOKENIZA_GOV_API_URL` | `https://poksiicnojklsnjgiklk.supabase.co/functions/v1/investor-export` |
| `TOKENIZA_GOV_API_KEY` | `tkg-sync-2026-b7f3a9e1d4c8` |

## Passo 2 — Testar a integração

Chamar `tokeniza-gov-sync` via curl para validar o fluxo completo:
- Amélia chama Tokeniza Gov → recebe investidores → popula `contacts`, `cs_customers`, `cs_contracts`

