## Investigação: Erro ao dar GANHO no deal "Tiago" (Tokeniza)

### Causa raiz encontrada

O deal "Tiago" (id: `3534dda6...`) está com status `ABERTO` — a operação de fechar como GANHO falhou.

O erro no banco de dados é:

> `there is no unique or exclusion constraint matching the ON CONFLICT specification`

Ele é disparado pelo trigger `**fn_deal_ganho_to_cs_contract**`, que executa:

```sql
INSERT INTO cs_contracts (customer_id, empresa, ano_fiscal, ...)
VALUES (...)
ON CONFLICT (customer_id, ano_fiscal) DO UPDATE SET ...
```

Porém a tabela `cs_contracts` **não possui** uma constraint unique em `(customer_id, ano_fiscal)`. Resultado: o Postgres rejeita o `ON CONFLICT`, o trigger falha, e o UPDATE inteiro do deal é revertido. Na tokeniza não existe o conceito de ano fiscal.

### Problema secundário

Também há erros recorrentes `column deals.pipeline_empresa does not exist` — provavelmente queries de fundo (workbench, metas) que estão tentando acessar `pipeline_empresa` direto na tabela `deals` ao invés de uma view. Isso não bloqueia o GANHO, mas gera toasts de erro na interface.

### Plano de correção

**1. Criar a constraint faltante na `cs_contracts**` (migration SQL):

```sql
ALTER TABLE public.cs_contracts
ADD CONSTRAINT cs_contracts_customer_ano_key UNIQUE (customer_id, ano_fiscal);
```

**2. Melhorar o `handleWin` com `onError` explícito** em `DealDetailSheet.tsx` para mostrar a mensagem real do erro ao invés de "Erro inesperado".

### Arquivos afetados

- Migration SQL (constraint na tabela `cs_contracts`)
- `src/components/deals/DealDetailSheet.tsx` (adicionar `onError` no `handleWin`)