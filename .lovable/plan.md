

# Contratos e Renovacoes por Ano Fiscal — Enriquecimento CS Blue

## Contexto

A Blue vende servicos anuais de IR Cripto por ano fiscal (ex: Diamond 2023, Gold 2024). Hoje o `cs_customers` tem apenas `proxima_renovacao` e `valor_mrr` — nao ha registro granular de **quais anos foram contratados**, qual plano, se renovou ou nao. Isso impede filtros como "clientes que compraram 2024 mas nao renovaram 2025".

## Solucao

Criar uma tabela `cs_contracts` que registra cada contrato/ano fiscal individualmente, vinculada ao `cs_customer`. Com isso, a listagem de clientes ganha filtros avancados e a pagina de detalhe mostra o historico completo de contratacoes.

## Estrutura da tabela `cs_contracts`

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | |
| customer_id | uuid FK cs_customers | Cliente CS |
| empresa | empresa_tipo | Tenant |
| ano_fiscal | integer | Ano fiscal coberto (2019, 2020...) |
| plano | text | Nome do plano (Diamond, Gold, etc.) |
| valor | numeric(14,2) | Valor do contrato |
| data_contratacao | date | Quando contratou |
| data_vencimento | date | Quando vence/renova |
| status | text | ATIVO, RENOVADO, CANCELADO, PENDENTE |
| renovado_em | timestamptz | Data da renovacao (se renovou) |
| notas | text | Observacoes |
| created_at / updated_at | timestamptz | Auditoria |

Constraint unico: `(customer_id, ano_fiscal)` — um contrato por ano fiscal por cliente.

## Alteracoes no Frontend

### 1. Pagina de Listagem (`CSClientesPage`)
- Adicionar filtro **Ano Fiscal** (dropdown com anos disponiveis)
- Adicionar filtro **Status Contrato** (Ativo, Pendente Renovacao, Cancelado)
- Adicionar filtro combinado: "Comprou em [ano] e NAO renovou [ano+1]"
- Exibir colunas: Plano Atual, Ultimo Ano Contratado

### 2. Pagina de Detalhe (`CSClienteDetailPage`)
- Nova aba **Contratos** mostrando timeline de todos os contratos por ano fiscal
- Botao para adicionar novo contrato manualmente
- Indicador visual de gaps (anos sem contrato)

### 3. Dialog de Criacao (`CSCustomerCreateDialog`)
- Adicionar campos do primeiro contrato: ano fiscal, plano, valor, data contratacao

### 4. Novos hooks
- `useCSContracts(customerId)` — lista contratos de um cliente
- `useCreateCSContract()` — cria contrato
- `useUpdateCSContract()` — atualiza status/renovacao
- Atualizar `useCSCustomers` para suportar filtros por ano fiscal e status de contrato via join

## Detalhes tecnicos

### Migration SQL

```sql
CREATE TABLE cs_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES cs_customers(id) ON DELETE CASCADE,
  empresa empresa_tipo NOT NULL,
  ano_fiscal INTEGER NOT NULL,
  plano TEXT NOT NULL DEFAULT '',
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_contratacao DATE,
  data_vencimento DATE,
  status TEXT NOT NULL DEFAULT 'ATIVO'
    CHECK (status IN ('ATIVO','RENOVADO','CANCELADO','PENDENTE','VENCIDO')),
  renovado_em TIMESTAMPTZ,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, ano_fiscal)
);

ALTER TABLE cs_contracts ENABLE ROW LEVEL SECURITY;

-- RLS: mesma logica do cs_customers
CREATE POLICY "cs_contracts_select" ON cs_contracts
  FOR SELECT USING (empresa::text = ANY(get_user_empresas(auth.uid())));
CREATE POLICY "cs_contracts_insert" ON cs_contracts
  FOR INSERT WITH CHECK (empresa::text = ANY(get_user_empresas(auth.uid())));
CREATE POLICY "cs_contracts_update" ON cs_contracts
  FOR UPDATE USING (empresa::text = ANY(get_user_empresas(auth.uid())));
CREATE POLICY "cs_contracts_delete" ON cs_contracts
  FOR DELETE USING (empresa::text = ANY(get_user_empresas(auth.uid())));
```

### Query de filtro "comprou ano X, nao renovou ano Y"

```sql
SELECT c.* FROM cs_customers c
JOIN cs_contracts ct ON ct.customer_id = c.id AND ct.ano_fiscal = 2024
WHERE NOT EXISTS (
  SELECT 1 FROM cs_contracts ct2
  WHERE ct2.customer_id = c.id AND ct2.ano_fiscal = 2025
)
AND c.empresa = 'BLUE';
```

### Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar tabela `cs_contracts` com RLS |
| `src/types/customerSuccess.ts` | Adicionar tipos `CSContract`, `CSContractStatus` |
| `src/hooks/useCSContracts.ts` | Novo hook CRUD para contratos |
| `src/hooks/useCSCustomers.ts` | Adicionar filtros por ano_fiscal e status_contrato via subquery |
| `src/pages/cs/CSClientesPage.tsx` | Novos filtros (ano fiscal, status contrato, "nao renovou") |
| `src/pages/cs/CSClienteDetailPage.tsx` | Nova aba Contratos com timeline e formulario |
| `src/components/cs/CSCustomerCreateDialog.tsx` | Campos do primeiro contrato |
| `src/components/cs/CSContractForm.tsx` | Novo componente de formulario de contrato |

