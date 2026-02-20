
# Limpeza de Duplicatas Tokeniza — Plano Cirúrgico

## O que os dados mostram

A investigação revelou a causa raiz e o escopo exato do problema:

**Causa raiz**: O `sgt-full-import` nas execuções de hoje (20/02) criou novos `contacts` com `legacy_lead_id` diferentes para pessoas que já existiam no banco — porque o SGT retornou os mesmos clientes com IDs de lead distintos (provavelmente múltiplos cadastros do mesmo investidor no SGT). A lógica de busca por email que devia evitar isso não funcionou a tempo.

**Divisão dos dados:**

| Grupo | Contacts | CS Customers | Contratos detalhados | Origem |
|---|---|---|---|---|
| **MANTER** (criados antes de 20/02) | 191 | 191 | 1.827 | Histórico legítimo |
| **EXCLUIR** (criados em 20/02) | 1.704 | 1.704 | 18 (1 pessoa, migrar primeiro) | Duplicatas de hoje |

**Os 18 contratos criados hoje** pertencem todos ao `wesleymfernandes@gmail.com` — que NÃO tem registro antigo (é novo). Esses 18 contratos devem ser migrados para o cs_customer mais antigo criado hoje com seu email.

## O que será feito

### Passo 1 — Migrar os 18 contratos de wesleymfernandes

O contact `wesleymfernandes@gmail.com` foi criado hoje e tem 18 contratos. Antes de excluir, os contratos são migrados para o cs_customer mais antigo (menor `created_at`) desse email, e os outros cs_customers/contacts duplicados dele são excluídos.

```sql
-- Pegar o cs_customer mais antigo do wesleymfernandes
WITH primary_cs AS (
  SELECT cs.id as primary_cs_id
  FROM contacts c
  JOIN cs_customers cs ON cs.contact_id = c.id
  WHERE cs.empresa = 'TOKENIZA' AND c.email = 'wesleymfernandes@gmail.com'
  ORDER BY c.created_at ASC
  LIMIT 1
)
UPDATE cs_contracts
SET customer_id = (SELECT primary_cs_id FROM primary_cs)
WHERE customer_id IN (
  SELECT cs.id FROM contacts c
  JOIN cs_customers cs ON cs.contact_id = c.id
  WHERE cs.empresa = 'TOKENIZA' AND c.email = 'wesleymfernandes@gmail.com'
    AND cs.id != (SELECT primary_cs_id FROM primary_cs)
);
```

### Passo 2 — Excluir os cs_customers duplicados criados hoje

Remove todos os `cs_customers` de contacts criados em 20/02, **exceto** o cs_customer com contratos (o do wesleymfernandes após a migração).

```sql
DELETE FROM cs_customers
WHERE id IN (
  SELECT cs.id
  FROM contacts c
  JOIN cs_customers cs ON cs.contact_id = c.id
  LEFT JOIN cs_contracts cc ON cc.customer_id = cs.id
  WHERE cs.empresa = 'TOKENIZA'
    AND DATE(c.created_at) = '2026-02-20'
    AND cc.id IS NULL -- sem contratos
);
```

### Passo 3 — Excluir os contacts duplicados criados hoje

Remove os 1.704 contacts de hoje que não têm mais cs_customers vinculados.

```sql
DELETE FROM contacts
WHERE empresa = 'TOKENIZA'
  AND DATE(created_at) = '2026-02-20'
  AND id NOT IN (SELECT contact_id FROM cs_customers WHERE empresa = 'TOKENIZA');
```

### Passo 4 — Corrigir o sgt-full-import para evitar recorrência

O problema ocorreu porque o import usava `legacy_lead_id` como chave primária de deduplicação, mas o SGT retornou o mesmo investidor com múltiplos `lead_ids` diferentes. A correção é garantir que a busca por email seja feita **antes** de tentar inserir, e que o upsert use `email + empresa` como chave de deduplicação no nível do banco.

Ajuste na lógica de `processLead`:
- Antes de qualquer INSERT em `contacts`, buscar por `email + empresa` primeiro
- Se encontrar, atualizar o `legacy_lead_id` do existente e pular criação
- Não criar novo contact se email já existir na mesma empresa

## Resultado esperado após a limpeza

| Métrica | Antes | Depois |
|---|---|---|
| CS Customers Tokeniza | 1.895 | ~192 únicos |
| Contratos detalhados | 1.845 | 1.845 (intactos) |
| Contacts Tokeniza duplicados | 2.180 | 0 |

## Importante sobre os contratos existentes

Os **1.827 contratos dos registros antigos** (criados entre 13-19/02) **não serão tocados**. São os dados reais de investimento dos clientes Tokeniza, vindos do backfill anterior, e ficam intactos.

## Sobre "excluir tudo e reimportar"

Não é necessário nem recomendado. Motivo: excluir tudo destruiria os 1.845 contratos detalhados que foram importados via backfill individual (buscar-lead-api), que são dados valiosos que o `sgt-full-import` em massa **não consegue mais recuperar** (o endpoint bulk só retorna totais agregados, não o histórico por oferta). A abordagem cirúrgica preserva esses dados.
