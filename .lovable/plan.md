

# Atualizar datas reais dos investimentos

## Situação atual
- Todos os 7.775 contratos têm `data_contratacao = 2026-02-24` (data do sync, não do investimento)
- O código do `tokeniza-gov-sync` (este projeto) **já está correto**: mapeia `subscribed_at` → `data_contratacao` e calcula `data_primeiro_ganho` a partir do investimento mais antigo
- O código do `investor-export` (gov-key-keeper) **já está correto**: usa `pos.invested_at` como prioridade para `subscribed_at`
- O código do `sync-tokeniza` (gov-key-keeper) **já está correto**: captura `createdAt` da API e salva em `invested_at`

## O que falta (sequência)

### Passo 1 — Rodar `sync-tokeniza` no projeto [Tokeniza Gov](/projects/f8d2848a-cdde-44c2-8a72-46b4113f9a87)
Isso vai buscar as positions na API da Tokeniza e popular a coluna `invested_at` com o `createdAt` real de cada investimento. **Isso precisa ser feito pelo usuário no outro projeto.**

### Passo 2 — Rodar `tokeniza-gov-sync-orchestrator` neste projeto
Após o Passo 1, o `investor-export` vai retornar `subscribed_at` com as datas reais. O orchestrator vai atualizar:
- `cs_contracts.data_contratacao` → data real de cada investimento
- `cs_customers.data_primeiro_ganho` → data do investimento mais antigo do investidor
- A aba "Investimentos" vai mostrar as datas corretas automaticamente

## Nenhuma alteração de código necessária
Todo o código já está preparado. O bloqueio é operacional: o `sync-tokeniza` precisa ser executado no projeto gov-key-keeper para popular `invested_at` nas positions.

