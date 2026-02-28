
# Corrigir sync de contratos — positions nunca passam pelo filtro de status

## Problema raiz

Após processar milhares de investidores em múltiplas páginas, **zero contratos foram criados**. O log `cs_contracts_created: 0` aparece em TODAS as páginas. Isso prova que o filtro na linha 211-213 (`status === "confirmed" || status === "settled"`) **não encontra nenhuma position com esses valores**.

Os investidores TÊM positions (o `sgt_dados_extras` mostra `tokeniza_qtd_investimentos: 9` para o Edgar), mas o campo `status` dessas positions contém valores diferentes de `confirmed`/`settled`.

## Plano

### 1. Adicionar debug logging REAL dos status das positions
O logging anterior não foi efetivo. Adicionar log **antes** do filtro, para TODOS os investidores que têm positions, mostrando os status reais:

```ts
// Antes do filtro de confirmed/settled
if (investor.positions?.length) {
  const allStatuses = [...new Set(investor.positions.map(p => p.status))];
  console.log(`[sync] ${cpfClean} has ${investor.positions.length} positions, statuses: ${allStatuses.join(',')}`);
}
```

### 2. Deploy + rodar teste com 50 investidores
Chamar com `page_size: 50` para capturar os status reais nos logs.

### 3. Corrigir o filtro baseado nos status reais
Duas opções (dependendo do que os logs revelarem):
- **Opção A**: Se `is_active` já indica positions válidas → remover o filtro de status e usar `is_active` como critério
- **Opção B**: Adicionar os status reais ao `STATUS_MAP` 

### 4. Rodar orchestrator completo
Reprocessar todos os 7.217 investidores com o filtro corrigido.

### 5. Validar resultado
Confirmar que `cs_contracts` foi populado e que o Edgar Luiz Condé mostra seus 9 investimentos na UI.
