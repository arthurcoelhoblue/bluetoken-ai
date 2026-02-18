
# Sincronizacao de Clientes SGT -- Enriquecimento Completo

## Contexto

A API `buscar-lead-api` do SGT retorna dados ricos sobre cada lead, incluindo:
- `venda_realizada`, `valor_venda`, `data_venda` -- indicadores de cliente
- `stage_atual` (ex: "Cliente") -- stage do funil
- `cliente_status` (via Notion) -- status do cliente
- Dados Tokeniza: `tokeniza_investidor`, `tokeniza_valor_investido`, `tokeniza_qtd_investimentos`, `tokeniza_projetos`
- Dados Blue: `irpf_renda_anual`, `irpf_patrimonio_liquido`, `irpf_perfil_investidor`
- Dados Mautic: `mautic_score`, `mautic_page_hits`, `mautic_tags`
- Dados LinkedIn: `linkedin_cargo`, `linkedin_empresa`, `linkedin_setor`, `linkedin_senioridade`
- Dados GA4/Stape: `ga4_engajamento_score`, `stape_paginas_visitadas`
- UTMs completos

O job atual (`sgt-sync-clientes`) busca apenas 20 contatos por vez, faz uma verificacao binaria (e/nao cliente) e nao traz nenhum dado enriquecido.

## O que muda

### 1. Reescrever `sgt-sync-clientes/index.ts`

**Deteccao de cliente melhorada:**
- `venda_realizada === true` OU
- `stage_atual === 'Cliente'` OU
- `cliente_status` contendo "ativo" ou "cliente" OU
- `tokeniza_investidor === true` (para TOKENIZA)

**Enriquecimento de dados no `contacts`:**
Quando o lead e encontrado no SGT, atualizar o contato local com todos os dados disponiveis:
- `score_marketing` com `score_temperatura` do SGT
- `linkedin_url`, `linkedin_cargo`, `linkedin_empresa`, `linkedin_setor` se presentes
- Tags relevantes (ex: `sgt-cliente`, `tokeniza-investidor`)

**Enriquecimento do `cs_customers`:**
Quando identificado como cliente, provisionar no CS com dados reais:
- `valor_mrr` baseado em `valor_venda` ou `tokeniza_valor_investido`
- `data_primeiro_ganho` usando `data_venda` do SGT (nao a data de sync)
- Tags: tipo de produto, empresa, projetos investidos

**Enriquecimento do `lead_contacts`:**
Atualizar dados do lead com informacoes do SGT:
- Dados de Mautic (score, page_hits, tags)
- Dados de LinkedIn (cargo, empresa, setor)
- Score de marketing

### 2. Aumentar batch e paginacao

- Aumentar `BATCH_SIZE` de 20 para 50
- Adicionar suporte a paginacao (offset) para processar TODOS os contatos ao longo de multiplas execucoes
- Salvar offset no `system_settings` para retomar de onde parou

### 3. Alimentar conhecimento da Amelia

Salvar dados enriquecidos no `lead_contacts` para que a Amelia (via copilot/SDR IA) tenha acesso ao historico do cliente:
- Historico de investimentos Tokeniza
- Produtos contratados na Blue
- Score e engajamento Mautic
- Dados LinkedIn para personalizacao

## Secao tecnica

### Arquivo: `supabase/functions/sgt-sync-clientes/index.ts`

Reescrever com a seguinte logica:

```text
1. Buscar contatos nao-cliente com email ou telefone (batch 50, com offset)
2. Para cada contato, chamar buscar-lead-api do SGT
3. Se lead encontrado:
   a. Extrair dados enriquecidos (linkedin, mautic, tokeniza, blue, utm)
   b. Atualizar contacts com dados enriquecidos
   c. Atualizar lead_contacts se legacy_lead_id existir
   d. Verificar se e cliente (venda_realizada, stage, tokeniza_investidor, etc)
   e. Se cliente:
      - Marcar contacts.is_cliente = true
      - Upsert cs_customers com valor_mrr e data_primeiro_ganho reais
      - Adicionar tags relevantes
4. Salvar offset para proxima execucao
5. Retornar relatorio detalhado
```

### Campos do SGT usados para deteccao de cliente:

| Campo SGT | Condicao |
|-----------|----------|
| `venda_realizada` | `=== true` |
| `stage_atual` | `=== 'Cliente'` |
| `tokeniza_investidor` | `=== true` (apenas TOKENIZA) |
| `cliente_status` | contendo 'ativo' ou 'cliente' (case-insensitive) |

### Campos do SGT usados para enriquecimento:

| Campo SGT | Campo local (contacts/lead_contacts) |
|-----------|--------------------------------------|
| `score_temperatura` | `score_marketing` |
| `linkedin_cargo` | `linkedin_cargo` |
| `linkedin_empresa` | `linkedin_empresa` |
| `linkedin_setor` | `linkedin_setor` |
| `linkedin_senioridade` | `linkedin_senioridade` |
| `mautic_score` | (lead_contacts) `score_mautic` |
| `mautic_page_hits` | (lead_contacts) `mautic_page_hits` |
| `valor_venda` | `cs_customers.valor_mrr` |
| `data_venda` | `cs_customers.data_primeiro_ganho` |
| `tokeniza_valor_investido` | `cs_customers.valor_mrr` (para TOKENIZA) |
| `tokeniza_qtd_investimentos` | tags no cs_customers |
| `utm_source/medium/campaign` | `lead_contacts.utm_*` |

### Deploy

Apenas 1 edge function modificada: `sgt-sync-clientes`
