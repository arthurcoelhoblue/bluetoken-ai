
# Importação Completa de Clientes SGT → CRM (755 Blue + 1049 Tokeniza)

## Diagnóstico do Gap

Situação atual:
- Blue: 755 clientes no SGT → apenas 212 no CRM (faltam 543)
- Tokeniza: 1049 investidores no SGT → apenas 250 no CRM (faltam 799)

**Por que faltam tantos?** Dois problemas combinados:

1. **Lógica de detecção invertida**: O `sgt-import-clientes` atual itera sobre contatos que JÁ EXISTEM no CRM e busca cada um no SGT. Clientes que existem no SGT mas nunca entraram no CRM como leads são invisíveis para essa função.

2. **`isCliente()` não captura a Blue corretamente**: A função verifica `stage_atual === 'Cliente'`, mas a Blue usa o stage `'Vendido'`. Isso faz com que centenas de clientes Blue passem pela verificação sem serem reconhecidos como clientes.

**A solução correta**: Em vez de "CRM busca SGT", inverter para "SGT lista → CRM importa". O SGT tem um endpoint `listar-clientes-api` que retorna todos os clientes paginados por empresa, o que permite uma varredura completa independente de o contato já existir no CRM.

---

## O que será feito

### 1. Nova Edge Function: `sgt-full-import` (substitui a lógica do `sgt-import-clientes`)

Ao invés de varrer os contatos do CRM, esta função:

1. Chama o endpoint `listar-clientes-api` do SGT com `empresa + offset`
2. Para cada cliente retornado pelo SGT, executa em cascata:
   - **Upsert `lead_contacts`** (pela bridge `legacy_lead_id`) 
   - **Upsert `contacts`** (pelo `legacy_lead_id` como chave)
   - **Upsert `cs_customers`** (por `contact_id + empresa`)
   - Para Tokeniza: **Upsert `cs_contracts`** com cada investimento
3. Salva o offset em `system_settings` para continuar em chamadas subsequentes
4. Retorna estatísticas do batch processado

**Critério de inclusão** (regras clarificadas com você):
- **Blue**: inclui se `plano_ativo = true` OU `cliente_status = 'ativo'` OU `venda_realizada = true` OU `stage_atual IN ('Vendido', 'Cliente')`
- **Tokeniza**: inclui se `tokeniza_investidor = true` OU tem ao menos 1 investimento com status `PAID/FINISHED`

**Critério de exclusão** (jogar no lixo):
- Blue sem plano contratado
- Tokeniza sem nenhum investimento realizado

### 2. Corrigir `isCliente()` nos arquivos existentes

Atualizar a função `isCliente()` em `sgt-import-clientes/index.ts` e `sgt-sync-clientes/index.ts` para incluir o stage `'Vendido'` da Blue:

```typescript
// ANTES (errado):
if (lead.stage_atual === 'Cliente') return true;

// DEPOIS (correto):
if (lead.stage_atual === 'Cliente' || lead.stage_atual === 'Vendido') return true;
if (empresa === 'BLUE' && lead.plano_ativo === true) return true;
```

### 3. Botão na UI `/cs/clientes` para disparar o import

Adicionar na página de clientes CS um botão "Sincronizar com SGT" (visível apenas para admins) que dispara a nova função. O botão mostra progresso: quantos foram processados, quantos novos foram criados, offset atual.

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `supabase/functions/sgt-full-import/index.ts` | Novo — função de importação baseada em listagem SGT |
| `supabase/functions/sgt-import-clientes/index.ts` | Corrigir `isCliente()`: adicionar `'Vendido'` e `plano_ativo` |
| `supabase/functions/sgt-sync-clientes/index.ts` | Corrigir `isCliente()`: mesma correção |
| `src/components/cs/CSCustomersPage.tsx` (ou equivalente) | Adicionar botão "Sincronizar com SGT" com feedback de progresso |
| `supabase/config.toml` | Registrar nova função `sgt-full-import` |

---

## Fluxo da nova função `sgt-full-import`

```text
POST /functions/v1/sgt-full-import
  { empresa: 'BLUE' | 'TOKENIZA', reset_offset?: true }

  1. Carrega offset de system_settings (categoria: 'sgt-full-import', key: empresa)
  2. Chama SGT: GET listar-clientes-api?empresa=BLUE&limit=200&offset=N
  3. Para cada cliente no resultado:
       a. Upsert contacts (legacy_lead_id = lead_id)
       b. Upsert cs_customers (contact_id + empresa)
       c. Se TOKENIZA: upsert cada investimento em cs_contracts
  4. Salva próximo offset
  5. Retorna { processados, novos_contatos, novos_cs_customers, novos_contratos, proximo_offset, ciclo_completo }
```

---

## Execução

Para cobrir os 755 + 1049 = 1804 clientes em batches de 200:
- Blue: ~4 chamadas para cobrir os 755 clientes
- Tokeniza: ~6 chamadas para cobrir os 1049 clientes

O botão na UI executa em loop automático até `ciclo_completo = true`.

---

## Impacto esperado

| Empresa | Antes | Depois | Novos |
|---|---|---|---|
| Blue | 212 | ~755 | +543 |
| Tokeniza | 250 | ~1049 | +799 |
| **Total** | **462** | **~1804** | **+1342** |

Clientes sem plano (Blue) ou sem investimento realizado (Tokeniza) não serão importados, conforme solicitado.
