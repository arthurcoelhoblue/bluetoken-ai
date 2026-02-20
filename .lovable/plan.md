
# Diagnóstico e Correção do SGT Full Import

## Resumo dos Problemas Encontrados

Há 3 problemas distintos em paralelo:

### Problema 1 — BLUE: Timeout (context canceled)
A edge function `sgt-full-import` para BLUE está levando mais de 30 segundos, causando timeout. Os logs de edge mostram que nenhuma chamada BLUE foi concluída com sucesso — apenas TOKENIZA tem registros recentes. O `context canceled` do curl confirma: a função é cancelada antes de retornar.

**Causa raiz**: O endpoint SGT `listar-clientes-api` para BLUE provavelmente inclui um join com `cliente_notion` que é lento. Com 755 clientes + join externo, a chamada excede 30s (limite padrão das edge functions).

**Solução**: Reduzir o `BATCH_SIZE` de 500 para 100 apenas para BLUE, e adicionar um timeout explícito de 25s na chamada fetch ao SGT, retornando um erro controlado ao invés de deixar cancelar.

### Problema 2 — TOKENIZA: 100% dos clientes sendo ignorados
Os logs mostram `ignorados: 500` em todos os batches da Tokeniza (2.351 registros processados, 0 aproveitados). O `isClienteElegivel` retorna `false` para todos.

**Causa raiz**: O endpoint `listar-clientes-api` foi criado pelo time do SGT mas os campos que a função espera não batem com o que é entregue. Especificamente:
- `tokeniza_investidor` pode não vir como campo raiz (pode ser `dados_tokeniza.investidor`)
- `dados_tokeniza.investimentos` pode ser `investimentos` na raiz
- Não temos visibilidade do schema exato da resposta

**Solução**: Adicionar logging detalhado do primeiro cliente de cada batch para inspecionar o schema real. Depois ampliar o `isClienteElegivel` para cobrir variações de campo.

### Problema 3 — Interface: erro de BLUE quebra o fluxo completo
Na sessão replay anterior, o erro de BLUE fez a sincronização pular para TOKENIZA com estatísticas zeradas. O `SGTSyncDialog` não trata erros de timeout adequadamente — mostra "erro na chamada" e para.

**Solução**: Melhorar o tratamento de erros no dialog para mostrar detalhes do timeout e permitir retry por empresa.

---

## O que será feito

### 1. Corrigir `sgt-full-import/index.ts`

**a. Timeout explícito no fetch ao SGT:**
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 25000); // 25s max

const sgtResponse = await fetch(SGT_LIST_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': sgtApiKey },
  body: JSON.stringify({ empresa, limit: BATCH_SIZE, offset }),
  signal: controller.signal,
});
clearTimeout(timeout);
```

**b. Batch size dinâmico por empresa:**
```typescript
const BATCH_SIZE_BLUE = 100;     // join com cliente_notion é mais lento
const BATCH_SIZE_TOKENIZA = 500; // dados planos, mais rápido
const batchSize = empresa === 'BLUE' ? BATCH_SIZE_BLUE : BATCH_SIZE_TOKENIZA;
```

**c. Log do schema do primeiro cliente recebido:**
```typescript
if (clientes.length > 0) {
  log.info('Sample lead schema', { 
    keys: Object.keys(clientes[0]),
    tokeniza_fields: {
      tokeniza_investidor: clientes[0].tokeniza_investidor,
      has_dados_tokeniza: !!clientes[0].dados_tokeniza,
      dados_tokeniza_keys: clientes[0].dados_tokeniza ? Object.keys(clientes[0].dados_tokeniza) : [],
      plano_ativo: clientes[0].plano_ativo,
      stage_atual: clientes[0].stage_atual,
    }
  });
}
```

**d. Ampliar `isClienteElegivel` para cobrir mais variações de campo:**
```typescript
if (empresa === 'TOKENIZA') {
  if (lead.tokeniza_investidor === true) return true;
  if (lead.is_investidor === true) return true;
  if (lead.dados_tokeniza?.investidor === true) return true;
  
  // Check investimentos in multiple locations
  const investimentos = 
    lead.dados_tokeniza?.investimentos || 
    lead.investimentos || 
    lead.dados_tokeniza?.aportes ||
    [];
  // ... rest of check
}
```

### 2. Nenhuma mudança na UI necessária agora

O problema da UI (erro de BLUE quebra fluxo) vai ser resolvido indiretamente: quando BLUE funcionar sem timeout, o fluxo completo vai rodar. Deixamos a UI como está por enquanto.

---

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/sgt-full-import/index.ts` | Timeout fetch 25s, batch size dinâmico (100 para BLUE / 500 para TOKENIZA), logs de schema, `isClienteElegivel` mais robusto |

---

## Sequência após o deploy

1. Deploy da função corrigida
2. Chamar via UI com "Sincronizar com SGT" 
3. Verificar logs da função para ver o schema real dos clientes
4. Se necessário, ajustar campo-alvo do `isClienteElegivel` baseado no schema observado
5. Rodar novamente para completar o import

---

## Por que TOKENIZA teve 2.351 registros mas esperávamos 1.049?

O endpoint `listar-clientes-api` provavelmente retorna **todos os leads da Tokeniza** (não só investidores), e o filtro `apenas_clientes` não está sendo aplicado — ou o SGT está retornando todos e esperando que o CRM filtre. Isso confirma que o `isClienteElegivel` precisa funcionar corretamente para que o filtro seja aplicado do lado do CRM.
