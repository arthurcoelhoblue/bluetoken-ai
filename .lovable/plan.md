

# Integração SGT 11/10 — Plano de Implementação

## Resumo

Consolidar 6 funções SGT redundantes em 3 funções limpas, eliminar codigo morto, centralizar deduplicação e garantir dados completos para Tokeniza (investimentos detalhados) e Blue (planos/status).

## Estado Atual — O Que Existe

| Funcao | Linhas | Endpoint SGT usado | Problema |
|---|---|---|---|
| `sgt-webhook` (565 linhas, 7 modulos) | Recebe push do SGT | N/A (recebe) | Dedup por `pessoa_id`, nao por email+empresa |
| `sgt-full-import` (568 linhas) | Bulk: `listar-clientes-api` | Dados agregados, sem investimentos individuais | Causou 1.700 duplicatas |
| `sgt-sync-clientes` (400 linhas) | Individual: `buscar-lead-api` | 1 HTTP/contato, N+1 | Codigo quase identico ao import |
| `sgt-import-clientes` (405 linhas) | Individual: `buscar-lead-api` | 1 HTTP/contato, N+1 | Clone do sync |
| `sgt-backfill-investimentos` (281 linhas) | Individual: `buscar-lead-api` | 1 HTTP/customer, so Tokeniza | Funciona mas e separado |
| `sgt-buscar-lead` (104 linhas) | Individual: `buscar-lead-api` | Proxy para frontend | OK, manter como esta |

**Frontend**: `SGTSyncDialog.tsx` chama `sgt-full-import`

## Endpoints do SGT (confirmado lendo o projeto)

### `listar-clientes-api` (POST)
- Input: `{ empresa, limit (max 500), offset, apenas_clientes }`
- Output: `{ total, clientes: [{ lead_id, nome, email, telefone, dados_tokeniza: { valor_investido, qtd_investimentos, projetos... } }] }`
- **NAO retorna investimentos individuais** (so totais agregados)

### `buscar-lead-api` (POST)
- Input: `{ email }` ou `{ telefone }`
- Output: `{ found, lead: {...}, dados_tokeniza: { investimentos: [{ oferta_nome, oferta_id, valor, data, status, tipo }] } }`
- **Retorna investimentos individuais** (crowdfunding + vendas)

## Arquitetura Final — 3 Funcoes

```text
SGT (Sistema de Trafego)
    |                    |                    |
  [PUSH]            [PULL bulk]        [PULL individual]
    |                    |                    |
    v                    v                    v
sgt-webhook         sgt-sync            sgt-buscar-lead
(existente,      (NOVA consolidada)     (existente,
 ajuste dedup)    2 fases internas       sem mudanca)
    |                    |                    |
    +--- _shared/contact-dedup.ts ---+       |
                     |                        |
              contacts / cs_customers / cs_contracts
```

## Passos de Implementacao

### Passo 1 — Criar `_shared/contact-dedup.ts`

Modulo compartilhado com funcao `findOrCreateContact()`:
- Hierarquia: `legacy_lead_id` -> `email + empresa` -> `telefone + empresa`
- Se encontrado por email/telefone, atualiza `legacy_lead_id` no existente
- So cria novo contact se nenhum match
- Retorna `{ contactId, isNew, wasUpdated }`

Tambem inclui: `upsertCsCustomer()` e `upsertTokenizaContracts()` — logica que hoje esta duplicada em 4 funcoes.

### Passo 2 — Criar `sgt-sync/index.ts` (funcao consolidada)

Aceita no body:
```json
{
  "empresa": "BLUE" | "TOKENIZA",
  "fase": "BULK" | "DETALHE" | null,
  "reset_offset": true | false
}
```

**Fase BULK** (usa `listar-clientes-api`):
- Pagina com offset persistido em `system_settings`
- Para cada cliente retornado: `findOrCreateContact()` + upsert `cs_customer` com dados agregados
- Pula clientes nao elegiveis (`isClienteElegivel()`)
- Para Blue: ja inclui dados de plano, status, valor_venda
- Para Tokeniza: inclui totais agregados (valor_investido, qtd, projetos)

**Fase DETALHE** (usa `buscar-lead-api`, so Tokeniza):
- Busca `cs_customers` da Tokeniza que **nao tem `cs_contracts` com `oferta_id` preenchido**
- Para cada um, chama `buscar-lead-api` por email
- Extrai `dados_tokeniza.investimentos` da resposta (array detalhado)
- Upsert em `cs_contracts` com `oferta_id`, `oferta_nome`, `valor`, `data`, `tipo`
- Offset separado em `system_settings`

**Sem fase especificada**: executa BULK primeiro, depois DETALHE

Reutiliza de `sgt-full-import`:
- `isClienteElegivel()` — logica de qualificacao
- `buildSgtExtras()` — montagem de dados extras
- `buildClienteTags()` — tags de CS

### Passo 3 — Atualizar `sgt-webhook` para usar `contact-dedup.ts`

Na secao "AUTO-CRIACAO / MERGE DE CONTATO CRM" (linhas 218-260), substituir a logica inline por `findOrCreateContact()` do modulo compartilhado. Isso garante que o webhook tambem use email+empresa como chave primaria de dedup, nao apenas `pessoa_id`.

### Passo 4 — Atualizar `SGTSyncDialog.tsx`

- Trocar chamada de `sgt-full-import` para `sgt-sync`
- Manter mesma interface visual (progress, stats por empresa)
- Adicionar opcao de rodar so fase BULK ou BULK+DETALHE

### Passo 5 — Excluir funcoes obsoletas

Remover completamente os diretorios:
- `supabase/functions/sgt-full-import/` (568 linhas)
- `supabase/functions/sgt-sync-clientes/` (400 linhas)
- `supabase/functions/sgt-import-clientes/` (405 linhas)
- `supabase/functions/sgt-backfill-investimentos/` (281 linhas)

Remover do `supabase/config.toml`:
- `[functions.sgt-full-import]`
- `[functions.sgt-sync-clientes]`
- `[functions.sgt-import-clientes]`

Remover deploy das funcoes excluidas via `delete_edge_functions`.

Adicionar ao `config.toml`:
- `[functions.sgt-sync]` com `verify_jwt = false`

### Passo 6 — Limpar `cs-backfill-contracts`

Verificar se `cs-backfill-contracts` tem referencias ao `sgt-backfill-investimentos` e atualizar se necessario (provavelmente independente).

## Codigo Eliminado vs Preservado

| Item | Acao | Linhas |
|---|---|---|
| `sgt-full-import/index.ts` | EXCLUIR | 568 linhas removidas |
| `sgt-sync-clientes/index.ts` | EXCLUIR | 400 linhas removidas |
| `sgt-import-clientes/index.ts` | EXCLUIR | 405 linhas removidas |
| `sgt-backfill-investimentos/index.ts` | EXCLUIR | 281 linhas removidas |
| `_shared/contact-dedup.ts` | CRIAR | ~150 linhas (logica consolidada) |
| `sgt-sync/index.ts` | CRIAR | ~350 linhas (2 fases, reutiliza shared) |
| `sgt-webhook/index.ts` | AJUSTAR | ~10 linhas alteradas (import + uso dedup) |
| `SGTSyncDialog.tsx` | AJUSTAR | ~5 linhas (trocar nome funcao) |
| `config.toml` | AJUSTAR | remover 3 entries, adicionar 1 |

**Saldo liquido**: -1.654 linhas de codigo redundante eliminadas, +500 linhas de codigo limpo e consolidado.

## Dados Essenciais Garantidos

**Tokeniza** (via Fase BULK + Fase DETALHE):
- Valor total investido, qtd investimentos, projetos (bulk)
- Cada investimento individual com oferta_nome, oferta_id, valor, data, status, tipo (detalhe)
- Carrinho abandonado, valor carrinho (bulk)
- LinkedIn, score temperatura (bulk)

**Blue** (via Fase BULK apenas):
- Plano ativo, plano atual (via Notion join no SGT)
- Status cliente, stage atual
- Valor venda, data venda
- Organizacao

## Reducao de Trafego

| Cenario | Antes | Depois |
|---|---|---|
| 1.000 clientes Tokeniza | 1.000 HTTP individuais | ~20 bulk + ~200 individuais (so os sem contrato) |
| Re-sync periodico | 1.000+ toda vez | ~20 bulk + 0 individuais (ja detalhados) |
| 750 clientes Blue | 750 HTTP individuais | ~15 bulk + 0 extras |

