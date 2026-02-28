

# Diagnóstico completo: Por que as datas ainda são `2026-02-24`

## O que encontrei cruzando os dois projetos

Consultei o projeto [Tokeniza Gov](/projects/f8d2848a-cdde-44c2-8a72-46b4113f9a87) e confirmei o fluxo completo:

### Cadeia de dados
```text
API Tokeniza → sync-tokeniza → positions.invested_at → investor-export → tokeniza-gov-sync → cs_contracts.data_contratacao
```

### Onde o problema está

O `sync-tokeniza` (linha 491) captura `pos.createdAt` da API Tokeniza e salva em `invested_at`. Porém, o campo `createdAt` da API **não é a data do investimento** — é o timestamp de criação do registro na plataforma Tokeniza. Todas as posições foram criadas em lote no dia `2026-02-24T20:31:20`, e é exatamente esse valor que aparece em todos os 7.836 contratos.

**Evidência nos logs diagnósticos deste projeto:** Cada `subscribed_at` retornado pelo `investor-export` é `2026-02-24T20:31:20.966145+00:00` (ou variantes de poucos segundos), confirmando que são timestamps de criação em batch, não datas históricas de investimento.

### O que precisa mudar

A API da Tokeniza precisa ter um campo com a data real do investimento (algo como `investedAt`, `paidAt`, `confirmedAt`, ou similar). O `createdAt` que está sendo usado é apenas a data em que a posição foi registrada no sistema.

## Ações necessárias

### 1. Investigar a API da Tokeniza (manual)
Verificar na documentação ou com o time da Tokeniza qual campo retorna a data real do aporte. Possíveis candidatos:
- `paidAt` / `paid_at`
- `confirmedAt` / `confirmed_at`  
- `investedAt` / `invested_at`
- Algum campo dentro de `subscriptions` que tenha a data real

### 2. Atualizar `sync-tokeniza` no projeto Tokeniza Gov
Depois de identificar o campo correto, alterar a linha 491:
```typescript
// De:
const posDate = pos.createdAt || (posAny.created_at as string) || null;
// Para (exemplo se o campo for paidAt):
const posDate = posAny.paidAt || posAny.paid_at || pos.createdAt || null;
```

### 3. Re-rodar sync + orchestrator
Após o ajuste, rodar `sync-tokeniza` no Tokeniza Gov e depois `tokeniza-gov-sync-orchestrator` aqui.

## Resumo
O código dos dois projetos está correto em termos de lógica de mapeamento. O problema é que a **fonte de dados** (`createdAt` da API Tokeniza) não contém a data real do investimento — contém a data de criação do registro no batch de `2026-02-24`.

