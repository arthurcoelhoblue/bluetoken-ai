
# Plano: Backfill de Investimentos Tokeniza

## Contexto

Existem 240 clientes Tokeniza na base, todos com contratos antigos sem detalhamento (`oferta_id = NULL`). O SGT agora envia o array `dados_tokeniza.investimentos` com os investimentos individuais, mas as functions existentes (`sgt-import-clientes` e `sgt-sync-clientes`) ainda referenciam `lead.tokeniza_investimentos` em vez de `lead.dados_tokeniza.investimentos`.

## O que precisa ser feito

### 1. Corrigir o caminho do campo nas functions existentes

Nas duas functions (`sgt-import-clientes` e `sgt-sync-clientes`), o campo que contem os investimentos individuais vem dentro de `dados_tokeniza`, nao diretamente no lead. Precisamos ajustar de:
- `lead.tokeniza_investimentos`

Para:
- `lead.dados_tokeniza?.investimentos`

Isso corrige tanto o fluxo normal quanto o backfill.

### 2. Criar edge function `sgt-backfill-investimentos`

Uma function dedicada e otimizada que:
- Busca apenas os `cs_customers` da Tokeniza que ainda nao tem contratos com `oferta_id` preenchido
- Para cada um, busca o contato associado (email/telefone)
- Chama a API do SGT para obter os dados completos incluindo `dados_tokeniza.investimentos`
- Faz upsert dos investimentos individuais em `cs_contracts`
- Processa em lotes de 50 (menor que o import geral, pois cada chamada SGT e individual)
- Usa offset persistido em `system_settings` para retomar de onde parou
- Pode ser chamada multiplas vezes ate processar todos os 240 clientes

### 3. Limpar contratos antigos sem detalhamento

Antes de inserir os investimentos detalhados, deletar os contratos Tokeniza antigos que tem `oferta_id IS NULL` para o customer em questao, evitando dados duplicados/desatualizados.

## Detalhes tecnicos

```text
Edge Function: sgt-backfill-investimentos

Fluxo:
1. Buscar cs_customers WHERE empresa='TOKENIZA' AND is_active=true
   LEFT JOIN cs_contracts (oferta_id IS NOT NULL) 
   -> filtrar os que tem 0 contratos detalhados
2. Paginar com offset (persistido em system_settings)
3. Para cada customer:
   a. Buscar contact (email/telefone)
   b. Chamar SGT buscar-lead-api
   c. Extrair dados_tokeniza.investimentos[]
   d. Deletar contratos antigos sem oferta_id para esse customer
   e. Upsert cada investimento em cs_contracts
4. Salvar offset para proxima execucao
5. Retornar progresso (processados, total, erros)
```

Correções nas functions existentes:
```text
// DE:
lead.tokeniza_investimentos

// PARA:
lead.dados_tokeniza?.investimentos
```

## Execucao

Apos o deploy, basta chamar a function algumas vezes (5-6 chamadas de 50 cada) para processar todos os 240 clientes Tokeniza.
