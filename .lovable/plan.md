

## Plano: Corrigir parsing do sync_extensions

### Causa raiz

A API Zadarma retorna `{ numbers: [100, 103, 104, ...], pbx_id: 472122 }` mas o código procura por `extensions`, `info.extensions` ou `pbx_internals` — nenhum desses campos existe na resposta. Resultado: sempre retorna `extensions: []`.

### Correção

No `supabase/functions/zadarma-proxy/index.ts`, no case `sync_extensions` (linhas 257-278):

1. Adicionar `pbxResult?.numbers` como fonte de dados
2. Quando `numbers` é um array de inteiros simples (como `[100, 103, 108]`), mapear cada número para `{ extension_number, sip_login }` usando o `pbx_id` retornado

```typescript
const rawExts = pbxResult?.extensions || pbxResult?.info?.extensions || pbxResult?.pbx_internals || [];
const rawNumbers = pbxResult?.numbers || [];
const sipId = pbxResult?.pbx_id || pbxResult?.info?.sip_id || pbxResult?.sip_id || '';

let extensionsList = [];

if (Array.isArray(rawNumbers) && rawNumbers.length > 0 && extensionsList.length === 0) {
  // Zadarma returns { numbers: [100, 103, ...], pbx_id: 472122 }
  extensionsList = rawNumbers.map(n => ({
    extension_number: String(n),
    sip_login: sipId ? `${sipId}-${n}` : '',
  }));
}
```

Isso vai produzir: `[{ extension_number: "100", sip_login: "472122-100" }, { extension_number: "108", sip_login: "472122-108" }, ...]`

### Arquivo alterado

1. `supabase/functions/zadarma-proxy/index.ts` — fix do parsing no case `sync_extensions`

