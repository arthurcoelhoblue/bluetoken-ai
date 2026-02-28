
# Corrigir visibilidade dos investimentos Tokeniza na UI

## Problemas identificados

**Problema 1 — Filtro errado no hook de métricas**
O `useCSTokenizaMetrics` e `useCSTokenizaOfertas` filtram por `.eq('tipo', 'crowdfunding')`, mas os 7.724 contratos criados pelo sync têm `tipo = 'other'` (7.567) ou `tipo = 'mining'` (157). Resultado: zero métricas retornadas para todos os clientes.

**Problema 2 — Edgar Condé sem CPF no contact**
O contact do Edgar (`10ce3d8d`) tem `cpf = NULL`. Como o sync usa CPF para fazer match, ele não conseguiu vincular os contratos ao customer existente. Os 9 investimentos do Edgar estão registrados no `sgt_dados_extras` (populado antes), mas os `cs_contracts` nunca foram criados porque o sync não encontrou o CPF para fazer upsert.

## Plano

### 1. Remover filtro `tipo = 'crowdfunding'` do hook de métricas
Em `src/hooks/useCSTokenizaMetrics.ts`:
- Linha 19: remover `.eq('tipo', 'crowdfunding')` do `useCSTokenizaMetrics`
- Linha 71: remover `.eq('tipo', 'crowdfunding')` do `useCSTokenizaOfertas`

Os tipos reais são `other`, `mining`, `cri`, `cra`, `debenture`, `fidc`, `lc` — todos são investimentos válidos da Tokeniza.

### 2. Corrigir sync para lidar com contacts sem CPF
Em `supabase/functions/tokeniza-gov-sync/index.ts`, adicionar fallback: se o CPF não encontrar match, tentar buscar pelo `email` + `empresa` antes de criar um novo contact. Isso resolve o caso do Edgar e outros investidores cujo contact foi criado sem CPF.

### Detalhes técnicos
- O filtro `crowdfunding` era um resquício de quando se assumia que todos os `deal_asset_type` seriam `crowdfunding`. A API retorna tipos variados (`other`, `mining`, etc.)
- A correção do hook é a que terá impacto imediato — todos os 7.724 contratos passarão a aparecer nas métricas
- A correção do sync será aplicada no próximo reprocessamento
