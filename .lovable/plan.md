

## Ajustar trigger e constraint para Tokeniza (sem ano fiscal)

### Problema
O trigger `fn_deal_ganho_to_cs_contract` usa `ano_fiscal` para todas as empresas, e acabamos de criar uma constraint unique em `(customer_id, ano_fiscal)`. Na Tokeniza não existe conceito de ano fiscal — cada deal ganho deve gerar seu próprio contrato independente, sem deduplicar por ano.

### Solução

**1. Alterar a unique constraint** para incluir `empresa`, permitindo lógica diferente por empresa:
- Dropar a constraint `cs_contracts_customer_ano_key`
- Criar nova constraint parcial ou ajustar a lógica

Na verdade, a melhor abordagem: para Tokeniza, o trigger deve criar um contrato novo (sem `ON CONFLICT`) vinculado ao deal. Para Blue (e outras), mantém o comportamento atual com `ON CONFLICT` por ano fiscal.

**2. Atualizar o trigger `fn_deal_ganho_to_cs_contract`** (migration SQL):
- Se `v_empresa = 'TOKENIZA'`: fazer `INSERT` simples (sem `ON CONFLICT`), usando `ano_fiscal = 0` ou o ano corrente apenas como referência, mas sem deduplicação
- Se outra empresa: manter o comportamento atual com `ON CONFLICT (customer_id, ano_fiscal)`

**3. Ajustar a constraint unique** para ser parcial — aplicável apenas quando `empresa != 'TOKENIZA'`:
```sql
DROP CONSTRAINT cs_contracts_customer_ano_key;
CREATE UNIQUE INDEX cs_contracts_customer_ano_key 
  ON cs_contracts (customer_id, ano_fiscal) 
  WHERE empresa != 'TOKENIZA';
```

Isso permite que Tokeniza tenha múltiplos contratos para o mesmo cliente sem conflito, enquanto Blue Consult mantém a regra de um contrato por ano fiscal.

### Arquivos afetados
- Migration SQL (constraint parcial + trigger atualizado)

