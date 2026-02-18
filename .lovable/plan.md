

# Corrigir parsing da resposta do SGT no import de clientes

## Problema
A API do SGT (`buscar-lead-api`) retorna a resposta no formato:
```json
{ "found": true, "lead": { "venda_realizada": true, "tokeniza_investidor": true, ... } }
```

Porem tanto `sgt-import-clientes` quanto `sgt-sync-clientes` tratam o objeto raiz como se fosse o lead, sem extrair a propriedade `.lead`. Resultado: todos os campos ficam `undefined` e nenhum cliente e detectado.

## Correcao

### 1. `supabase/functions/sgt-import-clientes/index.ts`

Apos receber a resposta do SGT, extrair o lead corretamente:

```typescript
// ANTES (errado):
const sgtData = await sgtResponse.json();
const leads = Array.isArray(sgtData) ? sgtData : sgtData ? [sgtData] : [];
if (leads.length === 0) { skipped++; continue; }
const lead = leads[0];

// DEPOIS (correto):
const sgtData = await sgtResponse.json();
// Unwrap: API retorna { found, lead } ou array
let rawLead = null;
if (sgtData?.found && sgtData?.lead) {
  rawLead = sgtData.lead;
} else if (Array.isArray(sgtData) && sgtData.length > 0) {
  rawLead = sgtData[0]?.lead ?? sgtData[0];
} else if (sgtData && !sgtData.found) {
  skipped++; continue;
}
if (!rawLead) { skipped++; continue; }
const lead = rawLead;
```

### 2. `supabase/functions/sgt-sync-clientes/index.ts`

Aplicar a mesma correcao na funcao de sync diario, que tem o mesmo bug na mesma logica de parsing.

### 3. Resetar offset do import

Apos o fix, resetar o offset para 0 chamando a funcao com `{ "reset_offset": true }` para reprocessar todos os contatos desde o inicio com a logica corrigida.

## Resultado esperado

Com a correcao, os 1.855 contatos serao reprocessados e aqueles com `venda_realizada = true`, `tokeniza_investidor = true`, ou `stage_atual = 'Cliente'` serao detectados e criados como `cs_customers`. O cron temporario de 10 em 10 minutos completara o processo em aproximadamente 1h30.
