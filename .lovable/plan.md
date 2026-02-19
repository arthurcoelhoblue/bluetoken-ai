

# Corrigir contratos sem tipo e garantir que clientes sempre apareçam

## Problema

1. 63 contratos Tokeniza tem `tipo = null` — provavelmente sao crowdfunding mas vieram sem classificacao do SGT
2. Com o filtro `tipo = 'crowdfunding'` aplicado, clientes cujos contratos tem `tipo = null` aparecem sem investimentos ou somem das metricas
3. O cliente `ebsdesouza@yahoo.com.br` tem 1 contrato com `tipo = null` e possivelmente ~15 investimentos que nao foram sincronizados

## Solucao

### Passo 1: Corrigir dados existentes (migracao SQL)

Atualizar os 63 contratos Tokeniza com `tipo = null` para `tipo = 'crowdfunding'`:

```sql
UPDATE cs_contracts
SET tipo = 'crowdfunding', updated_at = now()
WHERE empresa = 'TOKENIZA' AND tipo IS NULL;
```

Isso garante que todos os contratos ja importados sejam considerados nas metricas.

### Passo 2: Recalcular `data_primeiro_ganho`

Apos corrigir o tipo, recalcular a data do primeiro investimento para os clientes afetados:

```sql
UPDATE cs_customers SET data_primeiro_ganho = sub.first_date
FROM (
  SELECT customer_id, MIN(data_contratacao)::timestamptz AS first_date
  FROM cs_contracts
  WHERE tipo = 'crowdfunding'
  GROUP BY customer_id
) sub
WHERE cs_customers.id = sub.customer_id
AND cs_customers.empresa = 'TOKENIZA';
```

### Passo 3: Garantir default na sincronizacao futura

Verificar o edge function de sincronizacao SGT (`sgt-sync` ou similar) para garantir que novos contratos Tokeniza recebam `tipo = 'crowdfunding'` como default quando o tipo nao vier preenchido da API.

### Resultado esperado

- Os 63 contratos passam a ser contabilizados como crowdfunding
- O cliente Barbosa de Souza volta a aparecer com seu investimento na listagem
- Novos contratos sincronizados sem tipo serao classificados corretamente
- Nenhum cliente "some" da interface por falta de classificacao

### Nota sobre os ~15 investimentos

O cliente `ebsdesouza@yahoo.com.br` tem apenas 1 contrato registrado no banco. Se ele tem ~15 investimentos na plataforma Tokeniza, esses registros ainda nao foram sincronizados do SGT. Isso e um problema de importacao/sync separado — posso investigar apos esta correcao.
