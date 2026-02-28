

# Plano de Evolução da Amélia — Baseado nos Documentos de Análise

## Status: ✅ IMPLEMENTADO (2026-02-28)

---

## 1. ✅ DISC Ativo no Response Generator (Gap Crítico)

**Implementado**: `getDiscToneInstruction` injetado como bloco `## TOM DE VOZ OBRIGATÓRIO` no system prompt do response-generator, tanto no prompt default quanto em prompts A/B testados.

**Arquivos**: `supabase/functions/sdr-ia-interpret/response-generator.ts`

---

## 2. ✅ Follow-ups Personalizados por DISC no Cadence Runner

**Implementado**: 
- Coluna `usa_llm BOOLEAN DEFAULT false` adicionada à tabela `message_templates`
- No `resolverMensagem`, quando `usa_llm = true` E o lead tem `perfil_disc`, chama `callAI` para reescrever o corpo do template adaptando o tom ao perfil DISC
- Templates com `usa_llm = false` continuam no fluxo atual (sem custo extra)

**Arquivos**: Migration SQL, `supabase/functions/cadence-runner/index.ts`

---

## 3. ✅ Sumarização Progressiva do Histórico

**Implementado**:
- Coluna `summary TEXT` adicionada à tabela `lead_conversation_state`
- No `message-parser.ts` (loadFullContext), se `historico.length > 10` e `summary` for nulo, chama `callAI` para sumarizar os turnos antigos em 1 parágrafo
- `response-generator.ts` usa `summary + últimas 5 mensagens` em vez de 8 mensagens brutas quando summary disponível

**Arquivos**: Migration SQL, `message-parser.ts`, `response-generator.ts`

---

## 4. ✅ Memória Semântica — lead_facts (CRM Vivo)

**Implementado**:
- Coluna `lead_facts JSONB DEFAULT '{}'` adicionada à tabela `lead_conversation_state`
- No `intent-classifier.ts`, `lead_facts_extraidos` adicionado ao schema JSON esperado do LLM
- No `action-executor.ts`, `lead_facts` persistidos via merge (nunca sobrescreve, apenas enriquece)
- No `response-generator.ts`, `lead_facts` injetados no prompt como `## FATOS CONHECIDOS DO LEAD`

**Arquivos**: Migration SQL, `intent-classifier.ts`, `action-executor.ts`, `response-generator.ts`, `index.ts`

---

## 5. ✅ Scoring de Engagement (Tempo de Resposta)

**Implementado**:
- No `action-executor.ts`, calcula `tempo_resposta` (diferença entre última mensagem outbound e a inbound atual)
- Ajusta `score_engajamento` do deal: resposta < 5 min = +15, < 30 min = +10, < 2h = +5, > 24h = -10

**Arquivos**: `supabase/functions/sdr-ia-interpret/action-executor.ts`

---

## 6. ✅ Dashboard de Resolução Autônoma

**Implementado**:
- View SQL `amelia_resolution_stats` criada com agregação por dia/empresa
- Métricas: total_conversas, escaladas, resolvidas_autonomamente, taxa_resolucao_pct

**Arquivos**: Migration SQL (view)
**Pendente**: Componente React no dashboard (próxima iteração)

---

## Resumo de Impacto

| Melhoria | Impacto | Status |
|---|---|---|
| 1. DISC no Response Generator | Alto — personalização real | ✅ |
| 2. DISC no Cadence Runner | Alto — follow-ups adaptados | ✅ |
| 3. Sumarização Progressiva | Alto — reduz custo ~40% | ✅ |
| 4. lead_facts (CRM Vivo) | Alto — contexto persistente | ✅ |
| 5. Scoring de Engagement | Médio — qualificação comportamental | ✅ |
| 6. Dashboard Resolução | Médio — visibilidade operacional | ✅ (view SQL) |
