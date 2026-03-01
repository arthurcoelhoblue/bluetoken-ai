# Crítica e Plano de Adequações — Análise Competitiva Crisp.chat

## Diagnóstico: Amélia vs. Arquitetura Crisp (4 Camadas)

O relatório aponta que o diferencial do Crisp não é o modelo de IA, mas a **separação de responsabilidades em 4 camadas**. Veja o estado atual da Amélia:


| Camada Crisp                           | Estado na Amélia                                                                              | Avaliação        |
| -------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------- |
| **1. Knowledge** (O que sabe)          | Implementado — `knowledge_sections`, `knowledge_faq`, `knowledge_embeddings`, RAG funcional   | ✅ Bom            |
| **2. Instructions** (Como se comporta) | **Hardcoded** em `intent-classifier.ts` e `response-generator.ts` (~80 linhas de prompt fixo) | ❌ Problema grave |
| **3. Routing Rules** (O que faz)       | **Hardcoded** — intents e ações fixas no código, sem tabela editável                          | ❌ Problema grave |
| **4. Business Desc.** (Quem é)         | **Hardcoded** — `empresaDesc` e regras por empresa são strings fixas no código                | ⚠️ Parcial       |


### Problemas concretos identificados

1. **Prompt monolítico**: O `SYSTEM_PROMPT` do intent-classifier tem ~25 linhas misturando persona, DISC, framework, compliance e formato JSON. Qualquer ajuste exige deploy.
2. **Threshold de confiança RAG muito baixo**: O threshold atual é `0.55` (linha 211 do response-generator). O relatório recomenda `0.70` para reduzir alucinações.
3. **Sem limiar de "não sei"**: A Amélia tenta responder mesmo com chunks de baixa similaridade. O Crisp escala para humano quando não tem confiança.
4. **Ciclo de revisão existe mas está subutilizado**: Há `knowledge_search_feedback` e `knowledge_gaps`, mas falta UI de revisão semanal com ação direta (criar FAQ a partir de gap).
5. **Tabela `prompt_versions` existe mas está desativada**: O código de A/B testing está comentado tanto no classifier quanto no generator.

---

## Plano de Adequações (3 fases)

### Fase 1 — Desacoplamento: Tabelas de Instructions e Routing Rules

Criar duas novas tabelas para tornar instruções e regras editáveis sem deploy:

**Tabela `ai_instructions**`

- `id`, `empresa`, `tipo` (enum: `PERSONA`, `TOM`, `COMPLIANCE`, `CANAL`, `PROCESSO`), `conteudo` (text), `ordem` (int), `ativo` (bool), `created_at`, `updated_at`
- Migrar o conteúdo hardcoded atual para registros nesta tabela

**Tabela `ai_routing_rules**`

- `id`, `empresa`, `intent` (text), `condicao` (jsonb — ex: `{"confidence_min": 0.8, "temperatura": "QUENTE"}`), `acao` (text — ex: `ESCALAR_HUMANO`), `prioridade` (int), `ativo` (bool), `created_at`, `updated_at`
- Migrar as regras de roteamento fixas (como "se cancelamento → escalar") para registros editáveis

**Tabela `ai_business_descriptions**`

- `id`, `empresa`, `descricao` (text), `regras_criticas` (text), `ativo` (bool)
- Migrar `empresaDesc`, `TOKENIZA_CRITICAL_RULE`, etc. para cá

No `sdr-ia-interpret`, o classifier e o generator passam a montar o prompt dinamicamente buscando essas 3 tabelas + knowledge (RAG) em runtime.

### Fase 2 — Threshold de confiança e "Diga que não sabe"

- Subir threshold do RAG de `0.55` → `0.70` no `response-generator.ts`
- Adicionar lógica: se o melhor chunk retornado tem similarity < 0.70, a Amélia responde com frase padrão configurável ("Preciso confirmar com a equipe") em vez de tentar responder
- Adicionar coluna `escalou_por_baixa_confianca` (bool) no `knowledge_search_feedback` para rastrear quantas vezes isso acontece

### Fase 3 — UI de Gerenciamento (Admin)

Nova página em Configuração com 3 abas:

1. **Instruções IA**: CRUD das `ai_instructions` por empresa — editor de texto para cada tipo (Persona, Tom, Compliance, Canal, Processo). Toggle ativo/inativo.
2. **Regras de Roteamento**: CRUD das `ai_routing_rules` — tabela editável com intent, condição, ação e prioridade. Drag-and-drop para reordenar.
3. **Descrição do Negócio**: CRUD das `ai_business_descriptions` — editor por empresa com campos de descrição geral e regras críticas.

Reativar a UI de `prompt_versions` para A/B testing do system prompt do classifier.

---

## Arquivos impactados


| Arquivo                                                     | Ação                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Migration SQL                                               | Criar tabelas `ai_instructions`, `ai_routing_rules`, `ai_business_descriptions` + seed com dados atuais |
| `supabase/functions/sdr-ia-interpret/intent-classifier.ts`  | Buscar instructions + business desc do banco em vez de hardcode                                         |
| `supabase/functions/sdr-ia-interpret/response-generator.ts` | Buscar instructions do banco + subir threshold para 0.70 + lógica "não sei"                             |
| `src/pages/admin/AiSettings.tsx` (novo)                     | UI de gerenciamento das 3 camadas                                                                       |
| `src/components/admin/AiInstructionsTab.tsx` (novo)         | CRUD de instruções                                                                                      |
| `src/components/admin/AiRoutingRulesTab.tsx` (novo)         | CRUD de regras de roteamento                                                                            |
| `src/components/admin/AiBusinessDescTab.tsx` (novo)         | CRUD de descrições de negócio                                                                           |
