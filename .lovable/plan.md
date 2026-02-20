
# Adaptar `sgt-full-import` para usar o novo endpoint `listar-clientes-api`

## O que muda

A situação atual é que `sgt-full-import` faz **1 chamada HTTP ao SGT por contato** — isso significa 755 chamadas para a Blue e 1049 para a Tokeniza. Com o novo endpoint `listar-clientes-api` do SGT, que retorna até 500 clientes por chamada com paginação, isso cai para **~2 chamadas para a Blue** e **~3 para a Tokeniza**. Exatamente o mesmo ganho que o time do SGT mencionou (de ~3.100 chamadas para ~10).

## Mudanças no `sgt-full-import/index.ts`

### 1. Trocar a URL e o modelo de iteração

**Antes (fluxo atual — ineficiente):**
```
query local lead_contacts (50 registros)
  → para cada um: POST buscar-lead-api (email ou telefone)
  → qualificação
  → upsert
```

**Depois (novo fluxo — direto):**
```
POST listar-clientes-api { empresa, limit: 500, offset }
  → retorna array de clientes já filtrados + dados_tokeniza aninhados
  → qualificação (mantida igual)
  → upsert (mantido igual)
```

### 2. Estrutura da resposta esperada do novo endpoint

O SGT mencionou que o endpoint:
- Retorna até **500 clientes por chamada** com paginação
- Inclui `plano_ativo` **já calculado** (Blue)
- Faz join com `cliente_notion` para Blue
- Retorna objeto `dados_tokeniza` **aninhado** para Tokeniza (igual ao `buscar-lead-api`)

A resposta provavelmente é `{ clientes: [...], total: N, has_more: bool }` ou similar. A lógica de `isClienteElegivel` e os upserts em cascata **não mudam** — só muda de onde vêm os dados.

### 3. Remoção da dependência de `lead_contacts`

A iteração sobre `lead_contacts` local desaparece completamente. O novo loop é direto contra o SGT com offset controlado pelo mesmo mecanismo de `system_settings` que já existe.

### 4. Batch size ajustado

De `50` para `500` (limite do novo endpoint). Isso significa que cada chamada à edge function processa 10x mais dados.

---

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/sgt-full-import/index.ts` | Trocar `buscar-lead-api` por `listar-clientes-api`, remover loop sobre `lead_contacts`, ajustar parser da resposta |

Nenhum outro arquivo muda — a UI (`SGTSyncDialog.tsx`), a qualificação (`isClienteElegivel`), os upserts e o sistema de offset permanecem intactos.

---

## Detalhe técnico: tratamento da resposta

O novo endpoint retorna os clientes já enriquecidos. Para garantir compatibilidade com a estrutura que o código já espera, o parser vai normalizar:

```typescript
// Resposta do listar-clientes-api:
// { clientes: [...], total: 1804, has_more: true }
//
// Cada cliente segue o mesmo schema do buscar-lead-api:
// { lead_id, nome, email, telefone, plano_ativo, dados_tokeniza: { investimentos: [...] }, ... }
```

O campo `dados_tokeniza.investimentos` já vem aninhado — exatamente como o código atual espera.

---

## Estimativa após a mudança

| | Antes | Depois |
|---|---|---|
| Blue (755 clientes) | 755 chamadas HTTP ao SGT | ~2 chamadas |
| Tokeniza (1049 clientes) | 1049 chamadas HTTP ao SGT | ~3 chamadas |
| Tempo estimado total | ~15-20 minutos | ~30-60 segundos |

