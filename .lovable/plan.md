

# Importacao em massa de clientes do SGT para o modulo de CS

## Situacao atual

- A funcao `sgt-sync-clientes` ja existe e roda diariamente as 9h via pg_cron
- Porem ela so verifica contatos que ja existem na tabela `contacts` com `is_cliente = false`
- Resultado: **0 cs_customers** cadastrados atualmente, apesar de haver 1.855 contatos elegíveis (1.356 Blue + 499 Tokeniza)
- O offset esta em 50, indicando que ja rodou pelo menos uma vez mas nao encontrou clientes (provavelmente porque o SGT nao retornou `venda_realizada = true` para os primeiros 50)

## Problema principal

A abordagem atual e muito lenta e limitada:
1. Processa apenas 50 contatos por execucao (1x/dia = semanas para cobrir 1.855)
2. So busca por email/telefone no SGT -- se o contato nao tiver esses dados, e ignorado
3. Depende do campo `is_cliente = false` como filtro, o que impede re-enriquecimento de dados

## Plano de acao

### 1. Criar funcao de importacao em massa: `sgt-import-clientes`

Nova edge function dedicada a fazer a carga inicial completa, separada da sync diaria. Diferenças da funcao existente:

- **Modo "full scan"**: Em vez de pegar contatos do nosso banco e buscar no SGT, consulta o SGT diretamente pedindo TODOS os clientes de cada empresa
- **Endpoint SGT adequado**: Usar um parametro de busca que retorne clientes em lote (verificar se o `buscar-lead-api` aceita filtro por `is_cliente` ou `stage=Cliente`)
- **Fallback**: Se o SGT so suporta busca individual, manter o approach de iterar contatos mas com batch maior (200) e sem filtro `is_cliente = false` para reprocessar todos

### 2. Ajustar a funcao existente `sgt-sync-clientes`

Melhorias para o sync diario apos a carga inicial:

- **Remover filtro `is_cliente = false`**: Processar TODOS os contatos ativos para capturar novos clientes e enriquecer dados de clientes existentes
- **Aumentar batch para 100**: Acelerar a cobertura do ciclo completo
- **Enriquecimento de cs_customers existentes**: Quando o contato ja tem cs_customer, atualizar tags e dados extras em vez de pular
- **Armazenar dados extras do SGT no cs_customer**: Usar o campo `notas_csm` ou criar coluna `sgt_dados_extras` (JSONB) para dados como valor investido, perfil, projetos, etc.

### 3. Adicionar coluna de dados SGT na tabela cs_customers

Migracao SQL para adicionar campo que armazene dados enriquecidos do SGT:

```sql
ALTER TABLE cs_customers ADD COLUMN IF NOT EXISTS sgt_dados_extras JSONB DEFAULT '{}'::jsonb;
ALTER TABLE cs_customers ADD COLUMN IF NOT EXISTS sgt_last_sync_at TIMESTAMPTZ;
```

Dados que serao armazenados nesse campo:
- `tokeniza_valor_investido`, `tokeniza_qtd_investimentos`, `tokeniza_projetos`
- `irpf_renda_anual`, `irpf_patrimonio_liquido`, `irpf_perfil_investidor`
- `ga4_engajamento_score`, `stape_paginas_visitadas`
- `mautic_score`, `mautic_tags`
- `cliente_status`, `plano_atual`

### 4. Execucao manual da carga inicial

Apos o deploy, disparar a funcao manualmente para processar todos os 1.855 contatos de uma vez (ou em poucos minutos via multiplas chamadas automaticas com offset).

### 5. Atualizar o CRON para frequencia maior (opcional)

O job atual roda 1x/dia as 9h. Podemos mudar para 2x/dia (9h e 18h) ou ate a cada 6h para manter os dados mais frescos.

---

## Secao tecnica

### Novo arquivo: `supabase/functions/sgt-import-clientes/index.ts`

Funcao que itera sobre TODOS os contatos ativos (sem filtro `is_cliente`), consulta o SGT, e:
1. Enriquece `contacts` e `lead_contacts` com dados do SGT
2. Detecta clientes e cria/atualiza `cs_customers`
3. Armazena dados extras no novo campo `sgt_dados_extras`
4. Marca `sgt_last_sync_at` com a data do ultimo sync
5. Usa batch de 200 e persiste offset em `system_settings` com chave propria (`sgt-import-offset`)

### Migracao SQL

```sql
ALTER TABLE cs_customers 
  ADD COLUMN IF NOT EXISTS sgt_dados_extras JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sgt_last_sync_at TIMESTAMPTZ;
```

### Ajustes em `sgt-sync-clientes/index.ts`

- Linha 146: Remover `.eq('is_cliente', false)` para processar todos
- Linha 8: Aumentar `BATCH_SIZE` para 100
- Apos upsert em `cs_customers`, tambem salvar `sgt_dados_extras` e `sgt_last_sync_at`
- Para clientes ja existentes em `cs_customers`, atualizar tags e dados extras

### Config TOML

```toml
[functions.sgt-import-clientes]
verify_jwt = false
```

### Deploy e execucao

1. Deploy das funcoes atualizadas
2. Executar `sgt-import-clientes` manualmente via curl para iniciar a carga
3. Acompanhar progresso pelo offset em `system_settings`

