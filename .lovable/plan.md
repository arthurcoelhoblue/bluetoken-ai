

# Corrigir datas de investimento usando `deals.start_date`

## Diagnóstico final

A cadeia de datas está assim:

```text
API Tokeniza → pos.createdAt (2026-02-24, data do batch)
            → sync-tokeniza → positions.invested_at = createdAt do batch
            → investor-export → subscribed_at = invested_at || created_at
            → tokeniza-gov-sync → cs_contracts.data_contratacao = subscribed_at
```

As datas de 2024/2025 que existem no banco do Gov estão na tabela **deals**, no campo `start_date`, que vem de `proj.startDate` da API Tokeniza. São as datas de início de cada projeto/oferta de investimento.

O `investor-export` busca `deals ( name, asset_type, status )` mas **não inclui `start_date`**. Esse campo é o melhor proxy disponível para a data real do investimento.

## Alterações necessárias

### 1. No projeto Tokeniza Gov — `investor-export/index.ts`

Duas mudanças:

**a)** Adicionar `start_date` ao select de deals (linha 59):
```typescript
deals ( name, asset_type, status, start_date )
```

**b)** Usar `start_date` do deal como fallback na construção do `subscribed_at` (linha 126):
```typescript
subscribed_at: pos.invested_at || subscriptionData?.subscribed_at || pos.deals?.start_date || pos.created_at,
```

Prioridade de fallback:
1. `invested_at` — data específica da posição (quando preenchida corretamente)
2. `subscriptions.subscribed_at` — data de subscrição (tabela vazia hoje)
3. `deals.start_date` — **data de início do projeto** (datas reais de 2024/2025)
4. `created_at` — último recurso

### 2. Neste projeto (Amélia) — nenhuma mudança de código

O `tokeniza-gov-sync` já mapeia `pos.subscribed_at` para `cs_contracts.data_contratacao`. Basta re-rodar o orchestrator após o deploy no Gov.

### 3. Passos de execução

1. Aplicar a alteração no `investor-export` do Tokeniza Gov (2 linhas)
2. Deploy da function no Gov
3. Rodar `tokeniza-gov-sync-orchestrator` aqui na Amélia
4. Verificar que as datas dos contratos agora refletem 2024/2025

## Código para aplicar no Tokeniza Gov

```typescript
// investor-export/index.ts — linha 59: adicionar start_date
deals ( name, asset_type, status, start_date )

// investor-export/index.ts — linha 126: adicionar fallback
subscribed_at: pos.invested_at || subscriptionData?.subscribed_at || pos.deals?.start_date || pos.created_at,
```

