
# Amelia Learning System -- Incremento: Deteccao de Sequencias Causais

## Contexto

O plano base ja cobre analise de padroes isolados (agrupamento por motivo de perda, frequencia de takeover, etc). Este incremento adiciona **deteccao de cadeias de eventos** que historicamente culminam em perda de deal ou cancelamento, com **alertas preventivos** quando um deal/lead ativo entra numa cadeia de risco.

---

## O que muda no plano original

### 1. Nova coluna na tabela `amelia_learnings`

Adicionar campo para armazenar sequencias detectadas:

```text
amelia_learnings (campos adicionais ao plano base)
  sequencia_eventos   JSONB NULL   -- array ordenado de eventos que formam o padrao
                                    -- ex: ["RECLAMACAO", "SEM_RESPOSTA_48H", "OBJECAO_PRECO", "PERDA"]
  sequencia_match_pct  NUMERIC NULL -- % dos casos onde essa sequencia resultou no desfecho
  sequencia_janela_dias INT NULL   -- janela temporal em dias onde a sequencia ocorre
```

Isso permite que a IA registre padroes como: "Em 70% dos casos, a sequencia RECLAMACAO -> SILENCIO_48H -> OBJECAO_PRECO resulta em PERDA dentro de 14 dias".

### 2. Nova analise na edge function `amelia-learn`: Mineracao de Sequencias

Adicionar uma 6a etapa de analise alem das 5 ja planejadas:

**Analise de Sequencias de Perda (deals):**
- Buscar todos os deals PERDIDOS nos ultimos 90 dias
- Para cada deal, reconstruir a timeline completa: `deal_activities` + `lead_message_intents` (se houver lead vinculado)
- Ordenar eventos cronologicamente e extrair a sequencia de "tipos" (ex: NOTA, CHAMADA, RECLAMACAO, PERDA)
- Enviar batch de ~20-30 timelines para a IA com o prompt: "Identifique sequencias de 2-4 eventos que aparecem em 50%+ dos deals perdidos mas em menos de 20% dos deals ganhos"
- Salvar sequencias detectadas como aprendizados tipo `SEQUENCIA_PERDA`

**Analise de Sequencias de Cancelamento/Churn (conversas):**
- Buscar leads com `opt_out = true` ou deals perdidos com categoria `CANCELAMENTO`
- Reconstruir timeline de intents: sequencia de `lead_message_intents` ordenada cronologicamente
- Extrair padroes de intents que precedem o desfecho negativo
- Ex: RECLAMACAO -> DUVIDA_TECNICA -> OBJECAO_RISCO -> OPT_OUT aparece em 4 de 6 cancelamentos
- Salvar como aprendizados tipo `SEQUENCIA_CHURN`

### 3. Novo modulo: Monitor de Sequencias Ativas (alerta preventivo)

Esta e a peca mais importante -- **deteccao em tempo real** de que um deal/lead ativo esta entrando numa sequencia de risco.

**Como funciona:**

Quando `amelia-learn` roda e gera sequencias validadas, essas sequencias ficam disponiveis como "regras".

Adicionar um check no `sdr-ia-interpret` (que ja roda a cada mensagem inbound):
- Apos interpretar a mensagem, buscar sequencias VALIDADAS da empresa
- Verificar se os ultimos N intents do lead formam o inicio de alguma sequencia de risco
- Se match >= 50% da sequencia: gerar alerta AMELIA_ALERTA com prioridade ALTA

Exemplo concreto:
```text
Sequencia validada: [RECLAMACAO, SEM_RESPOSTA_48H, OBJECAO_PRECO] -> PERDA (70%)

Lead "Maria" acaba de enviar mensagem classificada como RECLAMACAO.
Historico recente: ja teve uma OBJECAO_PRECO ha 3 dias.

Amelia detecta: 2 de 3 eventos da sequencia ja ocorreram.
Gera alerta: "Lead Maria esta num padrao que resultou em perda em 70% dos casos. 
Recomendacao: contato humano imediato para reverter."
```

Tambem adicionar verificacao no hook `useDealDetail` quando o deal e aberto:
- Se o deal tem atividades que matcham inicio de sequencia de risco, mostrar banner de alerta no detalhe do deal

### 4. Novo tipo de aprendizado e alerta

Adicionar aos tipos existentes do plano base:

```text
Tipos de aprendizado (incremento):
  SEQUENCIA_PERDA    -- Cadeia de eventos que leva a perda de deal
  SEQUENCIA_CHURN    -- Cadeia de intents que leva a cancelamento/opt-out
  SEQUENCIA_SUCESSO  -- (bonus) Cadeia que leva a ganho -- para reforcar bons padroes

Tipos de notificacao (incremento):
  AMELIA_SEQUENCIA   -- "Este lead/deal esta num padrao de risco detectado"
```

### 5. Evolucao do Card AmeliaInsightsCard

O card no Workbench (ja planejado) ganha uma subseccao:

```text
--- Padroes de Sequencia Ativos ---
[!] Lead Maria: 2/3 eventos de padrao de PERDA detectados (70% historico)
    Sequencia: RECLAMACAO -> [SEM_RESPOSTA_48H] -> OBJECAO_PRECO -> PERDA
    Recomendacao: Contato humano imediato
    [Ver Lead] [Ignorar]

[!] Deal #456 (Pipeline Comercial): 3/4 eventos de padrao de CHURN
    Sequencia: OBJECAO_PRECO -> SILENCIO -> RECLAMACAO -> [CANCELAMENTO]
    Recomendacao: Reuniao de retencao
    [Ver Deal] [Ignorar]
```

---

## Fontes de dados para reconstrucao de timeline

| Tabela | Eventos extraidos | Uso |
|--------|------------------|-----|
| `deal_activities` | NOTA, CHAMADA, REUNIAO, EMAIL, TAREFA, PERDA, GANHO, MUDANCA_ESTAGIO | Timeline do deal |
| `lead_message_intents` | RECLAMACAO, OBJECAO_PRECO, INTERESSE_COMPRA, OPT_OUT, etc | Timeline de intents do lead |
| `conversation_takeover_log` | ASSUMIR, DEVOLVER | Momentos de intervencao humana |
| `lead_messages` | INBOUND sem resposta (gap temporal) | Detectar SEM_RESPOSTA_XH |

A IA recebe essas timelines e identifica subsequencias recorrentes.

---

## Controle de custos (incremental)

| Item | Impacto |
|------|---------|
| Mineracao de sequencias | +1 chamada IA por execucao (batch de timelines) |
| Check de sequencia no sdr-ia-interpret | +1 query simples (buscar sequencias validadas) -- sem chamada IA extra |
| Total incremental | ~120 chamadas/mes adicionais (1 chamada x 4 execucoes/dia x 30 dias) |

O check no `sdr-ia-interpret` nao gera chamada IA adicional -- e apenas um match de array contra as sequencias ja salvas no banco.

---

## Arquivos afetados (incremento ao plano base)

| Acao | Arquivo | Descricao |
|------|---------|-----------|
| Ajustar | Migration `amelia_learnings` | Adicionar colunas sequencia_eventos, match_pct, janela_dias |
| Ajustar | `supabase/functions/amelia-learn/index.ts` | Adicionar etapa 6: mineracao de sequencias |
| Ajustar | `supabase/functions/sdr-ia-interpret/index.ts` | Adicionar check de sequencia ativa apos interpretar |
| Ajustar | `src/components/workbench/AmeliaInsightsCard.tsx` | Subseccao de sequencias ativas |
| Ajustar | `src/types/learning.ts` | Novos tipos SEQUENCIA_PERDA, SEQUENCIA_CHURN |

Nenhum arquivo novo -- tudo se encaixa nos mesmos arquivos do plano base, apenas com logica adicional.

---

## Exemplos concretos de sequencias que a Amelia detectaria

### Vendas (Pipeline)
| Sequencia | Desfecho | Alerta |
|-----------|----------|--------|
| OBJECAO_PRECO -> SILENCIO_72H -> RECLAMACAO | PERDA 65% | "Deal esta seguindo padrao de perda por preco. Agende reuniao de valor." |
| INTERESSE_COMPRA -> REUNIAO -> SEM_FOLLOWUP_48H | PERDA 55% | "Lead demonstrou interesse mas nao houve followup. Acao imediata recomendada." |
| MUDANCA_ESTAGIO_RAPIDA -> MUDANCA_ESTAGIO_RAPIDA -> SEM_ATIVIDADE | PERDA 60% | "Deal avancou rapido mas parou. Pode ser otimismo excessivo do vendedor." |

### Sucesso do Cliente / Retencao
| Sequencia | Desfecho | Alerta |
|-----------|----------|--------|
| RECLAMACAO -> DUVIDA_TECNICA -> OBJECAO_RISCO | CANCELAMENTO 70% | "Cliente esta num padrao pre-cancelamento. Acione CS proativamente." |
| RECLAMACAO -> RECLAMACAO -> SEM_RESPOSTA | OPT_OUT 80% | "Duas reclamacoes sem resolucao. Risco altissimo de churn." |

### Sucesso (reforco positivo)
| Sequencia | Desfecho | Insight |
|-----------|----------|---------|
| DUVIDA_PRODUTO -> REUNIAO -> NOTA_POSITIVA | GANHO 72% | "Leads que fazem perguntas e depois tem reuniao convertem bem. Priorize agendamento apos duvidas." |

---

## Resumo da mudanca

O plano original analisa padroes **isolados** (frequencia de um evento). Este incremento adiciona analise de **sequencias temporais** -- cadeias de 2-4 eventos que, quando ocorrem em ordem dentro de uma janela de tempo, predizem um desfecho com alta probabilidade. A Amelia nao so aprende essas sequencias como **monitora deals/leads ativos** e alerta preventivamente quando detecta o inicio de uma cadeia de risco.

Tudo se encaixa nos mesmos arquivos e infraestrutura do plano base, com custo incremental minimo (~120 chamadas IA/mes adicionais).
