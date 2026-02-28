

# Reprocessar sync completo + debug de contratos

## Diagnóstico

- **cs_contracts: 0 registros** para TOKENIZA (confirmado)
- **cs_customers: 1.002** com dados de investimentos no `sgt_dados_extras` (18 com qtd > 0)
- O filtro de status (`confirmed`/`settled`) está **correto** conforme a API documentada
- A causa provável: o sync anterior processou apenas page 0 antes do código de contratos estar estável, ou os investidores com positions `confirmed` estão em páginas posteriores

## Plano

### 1. Adicionar debug logging temporário no `tokeniza-gov-sync`
Antes do filtro de status (linha 207), logar os status reais das positions de cada investidor para confirmar o que a API retorna:
```
console.log(`[sync] ${cpfClean} positions: ${investor.positions?.map(p => p.status).join(',')}`)
```

### 2. Rodar teste com page_size=5 para validar contratos
Chamar `tokeniza-gov-sync` com `{ page: 0, page_size: 5 }` e verificar nos logs se contratos estão sendo criados.

### 3. Rodar orchestrator completo
Chamar `tokeniza-gov-sync-orchestrator` para reprocessar todos os ~7.200 investidores e popular os `cs_contracts`.

### 4. Validar resultado final
Consultar `cs_contracts` para confirmar que os registros foram criados corretamente.

