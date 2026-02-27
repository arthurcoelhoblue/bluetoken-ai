

# Plano de Evolução da Amélia — Baseado nos Documentos de Análise

Analisei os dois documentos e cruzei com o código atual. Concordo com o diagnóstico: a base é sólida, mas há 4 melhorias de alto impacto e baixo custo que vão elevar o sistema significativamente. Aqui está o plano consolidado:

---

## 1. DISC Ativo no Response Generator (Gap Crítico)

**Diagnóstico confirmado**: A linha 178 do `response-generator.ts` tem apenas `Adapte ao perfil DISC: ${conversation_state?.perfil_disc || 'não identificado'}` — uma declaração fraca, não uma instrução.

**Ação**: Importar `getDiscToneInstruction` (já existe no `intent-classifier.ts`) e injetar como bloco `## TOM DE VOZ OBRIGATÓRIO` no system prompt do response-generator, tanto no prompt default (linha 175) quanto no prompt do `generateResponse`.

**Arquivos**: `supabase/functions/sdr-ia-interpret/response-generator.ts`

---

## 2. Follow-ups Personalizados por DISC no Cadence Runner

**Diagnóstico confirmado**: O `cadence-runner` resolve templates fixos via `resolverPlaceholders` (linha 264) sem qualquer adaptação DISC.

**Ação**:
- Adicionar coluna `usa_llm BOOLEAN DEFAULT false` na tabela `message_templates`
- No `resolverMensagem`, quando `usa_llm = true` E o lead tem `perfil_disc`, chamar `callAI` para reescrever o corpo do template adaptando o tom ao perfil DISC, usando o conteúdo original como base
- Templates com `usa_llm = false` continuam no fluxo atual (sem custo extra)

**Arquivos**: Migration SQL, `supabase/functions/cadence-runner/index.ts`

---

## 3. Sumarização Progressiva do Histórico

**Diagnóstico confirmado**: Hoje o histórico é cortado em 8 mensagens (linha 186 do response-generator). Em conversas longas, isso desperdiça tokens ou perde contexto antigo.

**Ação**:
- Adicionar coluna `summary TEXT` na tabela `lead_conversation_state`
- No `message-parser.ts` (loadFullContext), se `historico.length > 10` e `summary` for nulo, chamar `callAI` com modelo leve para sumarizar os turnos antigos em 1 parágrafo
- Salvar o resumo no `summary` e nas próximas chamadas usar `summary + últimas 5 mensagens` em vez de 8 mensagens brutas

**Arquivos**: Migration SQL, `supabase/functions/sdr-ia-interpret/message-parser.ts`, `response-generator.ts`, `intent-classifier.ts`

---

## 4. Memória Semântica — lead_facts (CRM Vivo)

**Diagnóstico confirmado**: A Amélia lembra estado do funil (BANT/SPIN) mas esquece fatos concretos (cargo, empresa, pain points).

**Ação**:
- Adicionar coluna `lead_facts JSONB DEFAULT '{}'` na tabela `lead_conversation_state`
- No `intent-classifier.ts`, adicionar `lead_facts` ao schema JSON esperado do LLM (campos: cargo, empresa_lead, pain_points, concorrentes, decisor)
- No `action-executor.ts`, persistir os `lead_facts` via merge (nunca sobrescrever, apenas enriquecer)
- No `response-generator.ts`, injetar os `lead_facts` no prompt para que a Amélia sempre saiba com quem fala

**Arquivos**: Migration SQL, `intent-classifier.ts`, `action-executor.ts`, `response-generator.ts`

---

## 5. Scoring de Engagement (Tempo de Resposta)

**Diagnóstico confirmado**: O score atual é baseado apenas no conteúdo da mensagem, não no comportamento.

**Ação**:
- No `action-executor.ts`, calcular `tempo_resposta` (diferença entre última mensagem outbound e a inbound atual)
- Ajustar `score_engajamento` do deal: resposta < 5 min = +15, < 30 min = +10, < 2h = +5, > 24h = -10
- Utilizar o campo `score_engajamento` já existente na tabela `deals`

**Arquivos**: `supabase/functions/sdr-ia-interpret/action-executor.ts`

---

## 6. Dashboard de Resolução Autônoma

**Ação**:
- Criar uma view SQL que agrega: total de conversas únicas vs conversas com `ESCALAR_HUMANO` ou `CRIAR_TAREFA_CLOSER`, por dia/semana/empresa
- Exibir como card/gráfico no dashboard existente da Amélia (página de métricas)

**Arquivos**: Migration SQL (view), componente React no dashboard

---

## Resumo de Impacto

| Melhoria | Impacto | Esforço |
|---|---|---|
| 1. DISC no Response Generator | Alto — personalização real | Baixo (5 linhas) |
| 2. DISC no Cadence Runner | Alto — follow-ups adaptados | Médio |
| 3. Sumarização Progressiva | Alto — reduz custo ~40% | Médio |
| 4. lead_facts (CRM Vivo) | Alto — contexto persistente | Médio |
| 5. Scoring de Engagement | Médio — qualificação comportamental | Baixo |
| 6. Dashboard Resolução | Médio — visibilidade operacional | Baixo |

## Ordem de Implementação Sugerida

1. DISC no Response Generator (impacto imediato, risco zero)
2. lead_facts + Sumarização (migration conjunta)
3. DISC no Cadence Runner
4. Scoring de Engagement
5. Dashboard de Resolução Autônoma

