
# Plano: Investimentos Tokeniza via SGT no CS

## Resumo

O SGT agora envia um array `investimentos[]` dentro de `dados_tokeniza` com o detalhamento de cada investimento (oferta, valor, data, status, tipo). Precisamos:

1. Receber e persistir esses investimentos individuais como registros em `cs_contracts`
2. Ajustar o schema para permitir multiplos registros por ano (Tokeniza pode ter N investimentos no mesmo ano)
3. Na UI, renomear a aba "Contratos" para "Investimentos" quando o cliente for Tokeniza

---

## Parte 1 -- Schema (Migracao SQL)

**Problema**: A constraint `UNIQUE(customer_id, ano_fiscal)` impede multiplos investimentos no mesmo ano para o mesmo cliente.

**Solucao**: 
- Dropar a constraint `cs_contracts_customer_id_ano_fiscal_key`
- Adicionar coluna `oferta_id TEXT NULL` e `oferta_nome TEXT NULL` para identificar a oferta/projeto do investimento
- Adicionar coluna `tipo TEXT NULL` (ex: "crowdfunding", "automatic-sales")
- Criar nova constraint `UNIQUE(customer_id, ano_fiscal, oferta_id)` para evitar duplicatas por oferta+ano
- A Blue continua funcionando normalmente (oferta_id sera NULL para contratos Blue, mantendo unicidade por ano)

```text
ALTER TABLE cs_contracts DROP CONSTRAINT cs_contracts_customer_id_ano_fiscal_key;
ALTER TABLE cs_contracts ADD COLUMN oferta_id TEXT;
ALTER TABLE cs_contracts ADD COLUMN oferta_nome TEXT;
ALTER TABLE cs_contracts ADD COLUMN tipo TEXT;
ALTER TABLE cs_contracts ADD CONSTRAINT cs_contracts_customer_oferta_key 
  UNIQUE (customer_id, ano_fiscal, oferta_id);
```

---

## Parte 2 -- Backend (Edge Functions)

### 2a. Atualizar tipo `DadosTokeniza` no sgt-webhook

Adicionar o campo `investimentos` na interface:

```text
interface InvestimentoTokeniza {
  oferta_nome: string;
  oferta_id: string;
  valor: number;
  data: string;
  status: string;
  tipo: string;
}

interface DadosTokeniza {
  // campos existentes...
  investimentos?: InvestimentoTokeniza[];
}
```

### 2b. Atualizar normalizacao no sgt-webhook

Passar o array `investimentos` atraves da normalizacao sem perder os dados.

### 2c. Atualizar sgt-import-clientes e sgt-sync-clientes

Quando o SGT retornar `investimentos[]` para um cliente Tokeniza:
- Para cada investimento, fazer upsert em `cs_contracts` com:
  - `customer_id` = cs_customer.id
  - `empresa` = 'TOKENIZA'
  - `ano_fiscal` = extraido da `data` do investimento
  - `plano` = oferta_nome
  - `oferta_id` = oferta_id do investimento
  - `oferta_nome` = oferta_nome
  - `tipo` = tipo (crowdfunding/automatic-sales)
  - `valor` = valor do investimento
  - `data_contratacao` = data do investimento
  - `status` = mapeamento FINISHED/PAID -> 'ATIVO'
  - `notas` = 'Importado do SGT'

---

## Parte 3 -- Frontend (UI)

### 3a. Aba dinamica: "Contratos" vs "Investimentos"

No `CSClienteDetailPage.tsx`:
- Se `customer.empresa === 'TOKENIZA'`, exibir "Investimentos" no lugar de "Contratos"
- O card de cada item mostra a **oferta_nome** como titulo principal (em vez de "plano")
- A data exibida e a `data_contratacao` (data do investimento)
- Ocultar o botao "Novo Contrato" para Tokeniza (investimentos sao importados automaticamente)

### 3b. Atualizar tipos TypeScript

Adicionar `oferta_id`, `oferta_nome` e `tipo` na interface `CSContract`.

---

## Sequencia de implementacao

1. Migracao SQL (schema)
2. Atualizar tipos no sgt-webhook (`DadosTokeniza` + `InvestimentoTokeniza`)
3. Atualizar normalizacao para propagar `investimentos[]`
4. Atualizar `sgt-import-clientes` e `sgt-sync-clientes` para criar contratos por investimento
5. Atualizar tipos frontend (`CSContract`)
6. Atualizar UI da aba Contratos/Investimentos
