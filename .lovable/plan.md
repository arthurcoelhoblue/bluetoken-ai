

# Fix: "Deal deve ter um vendedor (owner_id) atribuído"

## Problema
O trigger `validate_deal_owner` exige `owner_id` em todo deal, mas o `sgt-webhook` cria deals sem atribuir vendedor (linha 439-450 do `index.ts`). Isso causa erro em toda entrada de lead via SGT.

## Causa Raiz
O insert do deal no webhook não inclui `owner_id`. O trigger bloqueia o INSERT e o erro é capturado no catch (linha 452), mas o deal nunca é criado.

## Solução: Round-Robin por empresa

### 1. Alterar `sgt-webhook/index.ts` — Atribuição automática de vendedor
Antes do insert do deal (linha ~439), buscar um vendedor disponível por round-robin:

```
Query: profiles com is_vendedor=true + user_access_assignments para a empresa
Ordenar pelo vendedor com menos deals abertos no pipeline alvo
Atribuir owner_id ao deal
```

Lógica:
- Buscar vendedores ativos da empresa (`is_vendedor = true`, `is_active = true`)
- Contar deals abertos por vendedor no pipeline alvo
- Selecionar o vendedor com menos deals (least-loaded)
- Se nenhum vendedor disponível, buscar ADMIN da empresa como fallback
- Se ainda nenhum, logar warning e pular criação do deal (sem crashar)

### 2. Detalhes técnicos

No `index.ts`, antes da linha 439, adicionar:
```typescript
// Buscar vendedor least-loaded para a empresa
const { data: sellers } = await supabase
  .from('user_access_assignments')
  .select('user_id, profiles!inner(is_vendedor, is_active)')
  .eq('empresa', payload.empresa)
  .eq('profiles.is_vendedor', true)
  .eq('profiles.is_active', true);

let assignedOwnerId: string | null = null;
if (sellers && sellers.length > 0) {
  // Contar deals abertos por vendedor
  // Atribuir ao com menos deals
}
```

Incluir `owner_id: assignedOwnerId` no insert do deal.

Se `assignedOwnerId` é null, pular criação do deal com log de warning em vez de crashar.

## Resultado
- Deals criados automaticamente com vendedor atribuído via round-robin
- Sem mais erros no Sentry por falta de `owner_id`
- Distribuição equilibrada de leads entre vendedores

