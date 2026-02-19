
# Reset do import + Carga retroativa de contratos

## 1. Disparar reset do import com sanitizacao

O `sgt-import-clientes` ja aceita `reset_offset: true` no body. Basta invocar a funcao com esse parametro para reprocessar todos os contatos com a sanitizacao de nomes ativa.

**Acao**: Invocar a edge function diretamente apos o deploy. Nao precisa de codigo novo — a logica de reset ja existe.

**Fix necessario**: O arquivo `sgt-import-clientes/index.ts` tem um import duplicado na linha 4-5 (`import { createClient }` aparece duas vezes). Isso sera corrigido antes do deploy.

## 2. Edge function dedicada: `cs-backfill-contracts`

Criar uma nova edge function que percorre todos os `cs_customers` e gera contratos retroativos baseados em `data_primeiro_ganho` e `valor_mrr`.

**Logica:**

Para cada cs_customer com `data_primeiro_ganho` preenchido:
1. Verificar se ja tem contrato em `cs_contracts` — se sim, pular
2. Criar contrato com:
   - `ano_fiscal` = ano de `data_primeiro_ganho`
   - `valor` = `valor_mrr` do cliente
   - `data_contratacao` = `data_primeiro_ganho`
   - `data_vencimento` = `data_primeiro_ganho` + 12 meses
   - `status` = se vencimento < hoje → 'VENCIDO', senao → 'ATIVO'
3. Calcular `proxima_renovacao` = `data_primeiro_ganho` + 9 meses
4. Atualizar `cs_customers.proxima_renovacao`

**Processamento em lote**: 100 clientes por execucao com persistencia de offset (mesmo padrao do import).

**Resultados esperados**: 449 contratos criados, 449 clientes com `proxima_renovacao` preenchido.

## Secao tecnica

### Arquivo: `supabase/functions/cs-backfill-contracts/index.ts` (NOVO)

```text
Fluxo:
1. Ler offset de system_settings (category: 'cs-backfill', key: 'contracts-offset')
2. Buscar cs_customers com data_primeiro_ganho NOT NULL, range(offset, offset+99)
3. Para cada:
   a. Checar se ja existe cs_contract para esse customer_id
   b. Se nao: INSERT cs_contracts com dados calculados
   c. UPDATE cs_customers.proxima_renovacao
4. Salvar proximo offset
5. Retornar { processed, created, skipped, next_offset, ciclo_completo }
```

### Arquivo: `supabase/config.toml`

Adicionar:
```
[functions.cs-backfill-contracts]
verify_jwt = false
```

### Arquivo: `supabase/functions/sgt-import-clientes/index.ts`

- Remover import duplicado da linha 5

### Execucao

Apos deploy:
1. Chamar `sgt-import-clientes` com `{ "reset_offset": true }` — reprocessa nomes
2. Chamar `cs-backfill-contracts` repetidamente ate `ciclo_completo: true` — gera contratos retroativos

Ambas as chamadas podem ser feitas pela interface de teste de edge functions.
