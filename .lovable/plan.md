

# Item 9 do Parecer V4 — Pos-Producao: De 9.2 Para 11/10

Implementacao das 6 melhorias pos-producao que transformam o Blue CRM de "muito bom" para "referencia de mercado".

---

## Sugestao 1: Atividade auto-criada apos transcricao de chamada

**Status atual:** JA IMPLEMENTADO em `call-transcribe/index.ts` (linhas 205-220). Quando `call.deal_id` existe e `analysis.summary` esta disponivel, o sistema ja cria `deal_activities` com tipo `LIGACAO`, descricao formatada e metadata completa.

**Acao necessaria:** Nenhuma mudanca no backend. Apenas melhorar a visibilidade no frontend — garantir que o card de atividade de chamada apareca com destaque visual no `DealDetailSheet`.

| Arquivo | Mudanca |
|---------|---------|
| `src/components/deals/DealDetailSheet.tsx` | Adicionar icone de telefone e badge "Auto IA" para atividades com `metadata.source === 'call-transcribe-auto'` |

---

## Sugestao 2: Notas CS sugeridas pela Amelia

Quando o CSM abre a aba "Notas" de um cliente, o sistema analisa as ultimas interacoes (surveys, incidencias, health log) e sugere uma nota pre-preenchida.

### Nova Edge Function: `cs-suggest-note`

- Recebe `customer_id`
- Busca: ultimas 5 surveys, ultimas 5 incidencias, ultimos 3 health logs, `notas_csm` atual
- Envia contexto para Claude (primary) com Gemini fallback
- Prompt: "Baseado nos dados do cliente, sugira uma nota de acompanhamento em 2-3 frases que o CSM pode registrar"
- Retorna `{ sugestao: string }`
- Loga em `ai_usage_log`

### Frontend

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/cs/CSClienteDetailPage.tsx` | Na aba "Notas", adicionar botao "Sugerir Nota (Amelia)" que chama a edge function e pre-preenche o textarea. CSM aceita/edita antes de salvar |
| `supabase/config.toml` | Registrar `cs-suggest-note` com `verify_jwt = false` |

---

## Sugestao 3: A/B Testing de prompts via prompt_versions

A infraestrutura (`prompt_versions` tabela + hook `usePromptVersions`) ja existe. O que falta e a logica de split de trafego.

### Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/copilot-chat/index.ts` | Em vez de buscar apenas `is_active = true`, buscar todas as versoes com `is_active = true` e `ab_weight > 0`. Selecionar aleatoriamente com base nos pesos. Logar `prompt_version_id` no `ai_usage_log` |
| `supabase/functions/sdr-ia-interpret/index.ts` | Mesmo padrao de A/B testing |
| Migration SQL | Adicionar colunas `ab_weight` (int default 100) e `ab_group` (text nullable) na tabela `prompt_versions`. Adicionar coluna `prompt_version_id` (uuid nullable) na tabela `ai_usage_log` |
| `src/hooks/usePromptVersions.ts` | Expor `ab_weight` no tipo. Permitir editar peso no formulario |

### Logica de selecao

```text
Buscar todas prompt_versions ativas para a funcao
Calcular peso total (soma dos ab_weight)
Gerar random 0..pesoTotal
Iterar, acumular peso, selecionar a versao quando acumular >= random
```

---

## Sugestao 4: Dashboard de Saude Operacional

Nova pagina `/admin/operational-health` que mostra status em tempo real de todas as integracoes, CRON jobs e APIs de IA.

### Arquivos a criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/admin/OperationalHealthPage.tsx` | Pagina com cards de status para cada integracao (WhatsApp, Pipedrive, Claude, Gemini, SMTP, SGT, Blue Chat), ultimo CRON run, latencia media |
| `src/hooks/useOperationalHealth.ts` | Hook que chama `integration-health-check` para todas as integracoes em paralelo + busca `system_settings` para CRON status |

### Mudancas em arquivos existentes

| Arquivo | Mudanca |
|---------|---------|
| `src/App.tsx` | Adicionar rota `/admin/operational-health` com `requiredRoles={['ADMIN']}` |
| `src/config/screenRegistry.ts` | Registrar `saude_operacional` com url `/admin/operational-health` |
| `src/components/layout/AppSidebar.tsx` | Adicionar item "Saude Operacional" no menu Admin |

### Dados exibidos

- Status de cada integracao (online/offline/error) com indicador colorido
- Latencia da ultima verificacao
- Ultimo CRON run de cada funcao (buscado de `system_settings` key `cron_last_run`)
- Historico de falhas consecutivas (de `system_settings` key `consecutive_failures`)
- Botao "Verificar Agora" que dispara health check manual

---

## Sugestao 5: SDR-IA Modular

O `sdr-ia-interpret` tem 4.285 linhas. Dividir em 4 edge functions menores:

| Nova Funcao | Responsabilidade | Linhas aproximadas |
|-------------|------------------|--------------------|
| `sdr-message-parser` | Recebe mensagem, normaliza, detecta urgencia, carrega contexto (lead, deals, historico, conversation state) | ~500 |
| `sdr-intent-classifier` | Recebe contexto parsed, chama IA para classificar intent + framework data + temperatura | ~800 |
| `sdr-response-generator` | Recebe intent + contexto, gera resposta personalizada via IA (prompt de 2000+ linhas com regras por empresa/canal/persona) | ~1500 |
| `sdr-action-executor` | Recebe intent + acao recomendada, executa: pausar cadencia, criar tarefa closer, escalar humano, etc | ~500 |

### Orquestrador

O `sdr-ia-interpret` original vira um orquestrador fino (~200 linhas) que chama as 4 funcoes em sequencia:

```text
sdr-ia-interpret (orquestrador)
  -> sdr-message-parser (parse + contexto)
  -> sdr-intent-classifier (IA classifica)
  -> sdr-response-generator (IA gera resposta)
  -> sdr-action-executor (aplica acoes)
```

### Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/sdr-message-parser/index.ts` | Criar |
| `supabase/functions/sdr-intent-classifier/index.ts` | Criar |
| `supabase/functions/sdr-response-generator/index.ts` | Criar |
| `supabase/functions/sdr-action-executor/index.ts` | Criar |
| `supabase/functions/sdr-ia-interpret/index.ts` | Refatorar para orquestrador |
| `supabase/config.toml` | Registrar 4 novas funcoes |

---

## Sugestao 6: Previsao de receita com machine learning

O `revenue-forecast` atual usa heuristicas simples (ponderacao por probabilidade + churn). Evoluir para modelo de scoring baseado em features reais dos deals.

### Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/revenue-forecast/index.ts` | Adicionar feature engineering: tempo no stage atual, numero de atividades, engajamento (mensagens respondidas), score ICP, historico de deals ganhos similares. Chamar Claude para gerar predicao narrativa com justificativa. Salvar features e predicao no `revenue_forecast_log` |
| Migration SQL | Adicionar coluna `features` (jsonb nullable) na tabela `revenue_forecast_log` para armazenar as features usadas na predicao |

### Features a extrair por deal

```text
- dias_no_stage_atual
- total_atividades
- ultima_atividade_dias_atras
- mensagens_respondidas / mensagens_enviadas (taxa resposta)
- score_probabilidade_atual
- valor_deal
- icp_score (do lead associado)
- temperatura (do lead)
- canal_principal (whatsapp/email)
```

### Modelo

Em vez de ML tradicional (que requer treinamento), usar Claude para analisar os deals abertos com suas features contra o padrao dos deals ganhos/perdidos dos ultimos 180 dias, e gerar:
- Probabilidade ajustada (0-100) baseada em similaridade com deals ganhos
- Justificativa narrativa ("Este deal tem 73% de chance porque engajamento alto + ICP ideal, mas tempo no stage esta acima da media")
- Top 3 riscos e top 3 sinais positivos

---

## Migration SQL

Uma migration com:
- `ALTER TABLE prompt_versions ADD COLUMN ab_weight int NOT NULL DEFAULT 100`
- `ALTER TABLE prompt_versions ADD COLUMN ab_group text`
- `ALTER TABLE ai_usage_log ADD COLUMN prompt_version_id uuid`
- `ALTER TABLE revenue_forecast_log ADD COLUMN features jsonb`

---

## Resumo de Arquivos

### Novos (8 arquivos)

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/cs-suggest-note/index.ts` | Sugestao de nota CS via IA |
| `src/pages/admin/OperationalHealthPage.tsx` | Dashboard saude operacional |
| `src/hooks/useOperationalHealth.ts` | Hook para health check completo |
| `supabase/functions/sdr-message-parser/index.ts` | Parser de mensagem SDR |
| `supabase/functions/sdr-intent-classifier/index.ts` | Classificador de intent |
| `supabase/functions/sdr-response-generator/index.ts` | Gerador de resposta SDR |
| `supabase/functions/sdr-action-executor/index.ts` | Executor de acoes SDR |

### Modificados (10+ arquivos)

| Arquivo | Mudanca |
|---------|---------|
| `src/components/deals/DealDetailSheet.tsx` | Badge "Auto IA" em atividades de chamada |
| `src/pages/cs/CSClienteDetailPage.tsx` | Botao "Sugerir Nota (Amelia)" |
| `supabase/functions/copilot-chat/index.ts` | A/B testing de prompts |
| `supabase/functions/sdr-ia-interpret/index.ts` | Refatorar para orquestrador + A/B testing |
| `supabase/functions/revenue-forecast/index.ts` | Feature engineering + IA narrativa |
| `src/hooks/usePromptVersions.ts` | Suporte a `ab_weight` |
| `src/App.tsx` | Rota `/admin/operational-health` |
| `src/config/screenRegistry.ts` | Registrar tela |
| `src/components/layout/AppSidebar.tsx` | Item de menu |
| `supabase/config.toml` | 5 novas funcoes |

### Ordem de execucao recomendada

**Lote 1**: Migration SQL (colunas novas) + `cs-suggest-note` + aba notas com sugestao IA
**Lote 2**: Dashboard saude operacional (pagina + hook + rota + sidebar)
**Lote 3**: A/B testing prompts (copilot-chat + sdr-ia-interpret + hook)
**Lote 4**: SDR-IA modular (4 funcoes + orquestrador)
**Lote 5**: Revenue forecast com IA (feature engineering + Claude)
**Lote 6**: Badge "Auto IA" no DealDetailSheet

