# ChatBlue — Estudo Completo do Sistema de Machine Learning

> Análise detalhada de cada serviço, algoritmo, fórmula de scoring, fluxo de dados, rotas da API e jobs assíncronos do sistema de Machine Learning do ChatBlue.

---

## Sumário

1. [Visão Geral do Pipeline](#1-visão-geral-do-pipeline)
2. [Intent Classifier Service](#2-intent-classifier-service)
3. [Pattern Detector Service](#3-pattern-detector-service)
4. [ML Response Generator Service](#4-ml-response-generator-service)
5. [Quality Scorer Service](#5-quality-scorer-service)
6. [Training Pair Collector Service](#6-training-pair-collector-service)
7. [ML Integration Service](#7-ml-integration-service)
8. [Jobs Assíncronos (BullMQ)](#8-jobs-assíncronos-bullmq)
9. [API Routes — ML Learning](#9-api-routes--ml-learning)
10. [Modelos de Dados (Prisma)](#10-modelos-de-dados-prisma)
11. [Algoritmos e Fórmulas](#11-algoritmos-e-fórmulas)
12. [Ciclo de Aprendizagem Contínua](#12-ciclo-de-aprendizagem-contínua)
13. [Configurações e Thresholds](#13-configurações-e-thresholds)

---

## 1. Visão Geral do Pipeline

O sistema de ML do ChatBlue implementa um **ciclo de aprendizagem contínua** com 6 serviços que se interconectam:

```
                     MENSAGEM DO CLIENTE
                            │
                            ▼
              ┌──────────────────────────┐
              │   Intent Classifier      │  ← Classifica a intenção
              │   (3 camadas de análise) │
              └────────────┬─────────────┘
                           │
              ┌────────────┴──────────────────────────┐
              ▼                                        ▼
┌─────────────────────────┐          ┌────────────────────────────┐
│  ML Response Generator  │          │  Pattern Detector          │
│  (gera candidatos de    │          │  (detecta novos padrões    │
│   resposta)             │          │   emergentes)              │
└────────────┬────────────┘          └────────────────────────────┘
             │
             ▼
┌─────────────────────────┐
│   Quality Scorer        │  ← Avalia e ranqueia respostas
│   (5 dimensões)         │
└────────────┬────────────┘
             │
             ▼
        RESPOSTA FINAL
             │
             │  (após atendimento)
             ▼
┌─────────────────────────┐          ┌────────────────────────────┐
│ Training Pair Collector │──────────│  ML Integration Service    │
│ (coleta pares para      │          │  (hooks de eventos do      │
│  aprendizado)           │          │   sistema de atendimento)  │
└─────────────────────────┘          └────────────────────────────┘
```

---

## 2. Intent Classifier Service

**Arquivo:** `apps/api/src/services/ml/intent-classifier.service.ts`

### Propósito

Classifica a **intenção** de uma mensagem do cliente usando 3 camadas de análise em cascata:

### Interface de Retorno

```typescript
interface IntentClassification {
  intent: string;       // Ex: "PRICE_INQUIRY", "COMPLAINT", "ORDER_STATUS"
  category: string;     // Ex: "vendas", "suporte", "financeiro"
  confidence: number;   // 0-1
  subIntents: string[]; // Intenções secundárias detectadas
  keywords: string[];   // Palavras-chave encontradas
}
```

### 3 Camadas de Classificação

#### Camada 1: Keywords (rápido, sem custo de API)

```
mensagem.toLowerCase() → busca padrões no banco (MLIntentPattern) + padrões default
→ calcula score por correspondência de keywords
→ normaliza por sqrt(total_keywords)  ← evita penalizar padrões com muitas keywords
→ se confidence >= 0.7 → RETORNA
```

**Fórmula de score:**
```
score = matchedKeywords / √(totalKeywords)
confidence = min(score, 1.0)
```

**Sub-intents:** padrões com score >= 50% do melhor, limitados a 3.

#### Camada 2: Embedding Similarity (médio, custo de embedding)

Só ativada se a Camada 1 não atingiu o threshold de confiança (0.7).

```
1. Gera embedding da mensagem via EmbeddingService
2. Busca MLIntentPattern com centroidEmbedding no banco
3. Calcula similaridade de cosseno com cada padrão
4. Retorna o mais similar se confidence >= 0.7
```

Se o resultado de embedding for melhor que keywords, **substitui** a classificação.

#### Camada 3: LLM Fallback (lento, custo de API)

Só ativada se `useLLMFallback = true` E a confiança acumulada < 0.5.

```
1. Monta prompt com categorias e intents disponíveis
2. Inclui até 3 mensagens anteriores como contexto
3. Envia para LLM com temperature = 0.2 (alta precisão)
4. Parseia resposta JSON
```

### 16 Intenções Padrão (Predefinidas)

| Intent | Categoria | Keywords |
|--------|-----------|----------|
| `PRICE_INQUIRY` | vendas | preço, valor, quanto, custa, custo, orçamento, cotação |
| `PRODUCT_INFO` | vendas | produto, serviço, funciona, características, especificações |
| `PURCHASE_INTENT` | vendas | comprar, adquirir, contratar, fechar, quero, interesse |
| `AVAILABILITY` | vendas | disponível, estoque, prazo, entrega, quando, chega |
| `TECHNICAL_ISSUE` | suporte | erro, problema, bug, não funciona, travou, lento, falha |
| `HOW_TO` | suporte | como, faço, fazer, onde, consigo, acessar |
| `ACCOUNT_ISSUE` | suporte | conta, login, senha, acesso, cadastro, email |
| `PAYMENT_ISSUE` | financeiro | pagamento, boleto, cartão, pix, cobrança, fatura |
| `REFUND_REQUEST` | financeiro | reembolso, estorno, devolução, cancelar, cancelamento |
| `INVOICE_REQUEST` | financeiro | nota fiscal, nf, recibo, comprovante |
| `COMPLAINT` | atendimento | reclamação, insatisfeito, péssimo, horrível, absurdo |
| `HUMAN_REQUEST` | atendimento | atendente, humano, pessoa, transferir, falar com |
| `STATUS_CHECK` | atendimento | status, andamento, situação, acompanhar, pedido, protocolo |
| `GREETING` | geral | olá, oi, bom dia, boa tarde, boa noite, tudo bem |
| `THANKS` | geral | obrigado, obrigada, agradeço, valeu, thanks |
| `CONFIRMATION` | geral | sim, pode, ok, certo, confirmo, correto, isso |

### Treinamento (trainFromTrainingPairs)

```
1. Busca MLTrainingPair com qualityScore >= minQualityScore (default: 70)
2. Agrupa por intent → precisa de >= minOccurrences (default: 5) pares
3. Extrai keywords das frases (palavras com frequência >= 30% das frases)
4. Calcula centroide dos embeddings do grupo
5. Cria ou atualiza MLIntentPattern no banco
```

### Detecção de Novos Padrões (detectNewPatterns)

Clustering simplificado para training pairs sem intent classificado:

```
1. Busca training pairs sem intent E com embedding
2. Para cada par, busca o cluster mais similar (threshold: 0.7)
3. Se nenhum cluster similar → cria novo
4. Filtra clusters com >= minClusterSize (default: 5) itens
5. Retorna como novos padrões emergentes
```

---

## 3. Pattern Detector Service

**Arquivo:** `apps/api/src/services/ml/pattern-detector.service.ts`

### Propósito

Detecta padrões em training pairs e **extrai templates de resposta** automaticamente.

### Interface de Retorno

```typescript
interface DetectedPattern {
  intent: string;
  category: string;
  examplePhrases: string[];
  suggestedKeywords: string[];
  suggestedTemplate: string | null;
  occurrenceCount: number;
  avgQualityScore: number;
  confidence: number;
}
```

### Fluxo de Detecção (detectPatterns)

```
1. Busca MLTrainingPair com qualityScore >= minQualityScore (default: 60)
   → Limite: 1000 pares mais recentes
   → Opção de filtrar apenas não processados

2. Agrupa por "category:intent"
   → Pula grupos com < minOccurrences (default: 3) pares

3. Para cada grupo:
   a. Calcula qualidade média do grupo
   b. Extrai exemplos (até 10) e keywords
   c. Se grupo >= 5 pares E tem AIService:
      → Extrai template via LLM

4. Detecção adicional por clustering de embeddings
   → Similaridade threshold: 0.75
   → Mescla com padrões anteriores (evita duplicatas com overlap > 50%)
```

### Fórmula de Confiança

```
confidence = min(1, occurrenceCount / 20 + avgQualityScore / 100)
```

Exemplo: 10 ocorrências com qualidade média 80 → `min(1, 10/20 + 80/100) = min(1, 1.3) = 1.0`

### Extração de Templates (extractTemplate)

Usa LLM para analisar respostas similares e extrair um template generalizado:

```
Input: 5 respostas do mesmo intent/categoria
Output: Template com variáveis como {{nome}}, {{produto}}, {{valor}}
```

Exemplo de output:
```json
{
  "template": "Olá {{nome}}! O preço do {{produto}} é {{valor}}.",
  "variables": {
    "nome": "Nome do cliente",
    "produto": "Nome do produto",
    "valor": "Valor do produto"
  },
  "confidence": 0.85
}
```

### Salvamento (savePatterns)

- Filtra por `minConfidence` (default: 0.5)
- Cria ou atualiza `MLIntentPattern`
- Se tiver template, cria `MLResponseTemplate` com `sourceType: 'LEARNED'`

---

## 4. ML Response Generator Service

**Arquivo:** `apps/api/src/services/ml/ml-response-generator.service.ts`

### Propósito

Combina **templates**, **padrões de ML** e **knowledge base** para gerar respostas candidatas de alta qualidade.

### Interface de Retorno

```typescript
interface GeneratedResponse {
  response: string;
  confidence: number;
  source: 'TEMPLATE' | 'KNOWLEDGE_BASE' | 'LEARNED_PATTERN' | 'GENERATED' | 'HYBRID';
  templateId?: string;
  documentIds?: string[];
  patternId?: string;
  qualityScore?: number;
  metadata: {
    intent?: string;
    category?: string;
    processingTimeMs?: number;
  };
}
```

### Pipeline de 7 Etapas (generateResponses)

```
Etapa 1 — CLASSIFICAÇÃO DE INTENÇÃO
   └── IntentClassifier.classify() → intent + category

Etapa 2 — BUSCA PARALELA DE CANDIDATOS (Promise.all)
   ├── getTemplateResponses()      → templates do MLResponseTemplate
   ├── getPatternResponses()       → templates do MLIntentPattern
   └── getKnowledgeBaseResponses() → busca semântica nos documentos

Etapa 3 — GERAÇÃO COM LLM (se poucos candidatos)
   └── generateWithLLM() → resposta gerada com contexto da conversa

Etapa 4 — APLICAÇÃO DE VARIÁVEIS
   └── applyVariables() → substitui {{nome}}, {{cliente}}

Etapa 5 — RANKING DE QUALIDADE
   └── rankCandidates() → QualityScorer avalia cada candidato

Etapa 6 — METADATA
   └── Adiciona intent, category, processingTimeMs

Etapa 7 — RETORNO
   └── Top N candidatos (default: 3)
```

### Fontes de Resposta (por prioridade)

#### 1. Templates (MLResponseTemplate)

```
Busca por intent → depois por category → fallback: embedding similarity
Ordenado por: usageCount DESC, avgRating DESC
Confiança: 0.8 + (avgRating - 3) * 0.1
```

#### 2. Padrões Aprendidos (MLIntentPattern)

```
Busca por intent onde suggestedResponseTemplate não é null
Ordenado por: successRate DESC, occurrenceCount DESC
Confiança: successRate do padrão (ou 0.7 default)
```

#### 3. Knowledge Base (busca semântica)

```
embeddingService.semanticSearch() → threshold: 0.6, limit: 3
Confiança: score de similaridade do documento
```

#### 4. Geração com LLM (fallback)

```
Usa system prompt da empresa (companySettings.aiSystemPrompt)
Inclui até 5 mensagens anteriores como contexto
Inclui candidatos existentes como "inspiração"
Confiança fixa: 0.75
```

### Ranking de Candidatos

Se QualityScorer disponível:
```
finalConfidence = (originalConfidence * 0.6) + (qualityScore / 100 * 0.4)
```

### Registro de Uso (recordResponseUsage)

Quando uma resposta é usada:
- Se template: `usageCount +1`, `successCount +1` (se não editada)
- Se padrão: `occurrenceCount +1`

---

## 5. Quality Scorer Service

**Arquivo:** `apps/api/src/services/ml/quality-scorer.service.ts`

### Propósito

Avalia a qualidade de respostas (tanto da IA quanto de atendentes humanos) em **5 dimensões**.

### Interface de Retorno

```typescript
interface QualityScore {
  overallScore: number;       // 0-100 (média ponderada)
  relevanceScore: number;     // Quão relevante é a resposta
  completenessScore: number;  // A resposta é completa?
  clarityScore: number;       // A resposta é clara?
  toneScore: number;          // O tom é apropriado?
  factualScore: number;       // Factualmente correto (vs knowledge base)
  breakdown: {
    [key: string]: { score: number; reason: string };
  };
}
```

### Score Geral — Média Ponderada

```
overallScore = round(
  relevance     * 0.30 +
  completeness  * 0.25 +
  factual       * 0.20 +
  clarity       * 0.15 +
  tone          * 0.10
)
```

**Pesos visuais:**

```
Relevância    ████████████████████████████████  30%
Completude    ██████████████████████████        25%
Factualidade  ████████████████████              20%
Clareza       ████████████████                  15%
Tom           ██████████                        10%
```

### Dimensão 1: Relevância (30%)

**Com LLM:**
- Prompt pede score 0-100 avaliando se a resposta aborda diretamente o que foi perguntado
- `temperature: 0.3` para consistência

**Sem LLM (heurística):**
- Extrai palavras-chave da pergunta (>3 caracteres)
- Conta quantas aparecem na resposta
- `matchRatio > 0.6` → 90 | `> 0.3` → 75 | `> 0.1` → 60 | else → 40

### Dimensão 2: Completude (25%)

Análise heurística:
```
< 5 palavras                          → 30 "Resposta muito curta"
< 15 palavras + múltiplas perguntas   → 50 "Curta para múltiplas perguntas"
Não termina com .!?                   → 70 "Pode estar incompleta"
Múltiplas perguntas + estruturada     → 95 "Estruturada para múltiplas perguntas"
> 30 palavras                         → 90 "Resposta detalhada"
Padrão                                → 80 "Resposta adequada"
```

### Dimensão 3: Clareza (15%)

```
avgWordsPerSentence = wordCount / sentenceCount

> 30 palavras/frase                   → 60 "Frases muito longas"
> 3 siglas (CAPS)                     → 70 "Muitos termos técnicos"
Boa estrutura + < 20 pal./frase       → 95 "Bem estruturada"
< 15 palavras/frase                   → 90 "Frases claras e concisas"
Padrão                                → 80 "Clareza adequada"
```

### Dimensão 4: Tom (10%)

Sistema de pontos (base = 80):

| Critério | Impacto |
|----------|---------|
| Saudação (olá, bom dia...) | +5 |
| Fechamento (obrigado, à disposição...) | +5 |
| Linguagem negativa (não posso, infelizmente...) | -5 |
| Linguagem informal (kkkk, haha, vc, pq...) | -15 |
| Caps lock excessivo (>30% maiúsculas) | -10 |

Range: 0-100 (clamped)

### Dimensão 5: Factualidade (20%)

**Com knowledge base fornecida:**
```
avgScore de similaridade com documentos
> 0.8 → 95 "Altamente alinhado"
> 0.6 → 85 "Alinhado"
> 0.4 → 70 "Parcialmente alinhado"
else  → 50 "Pouco alinhamento"
```

**Sem knowledge base (com EmbeddingService):**
- Faz busca semântica com a resposta
- Calcula alinhamento com documentos encontrados

**Sem nada:** → 75 "Não foi possível validar"

### Funcionalidades Adicionais

#### scoreBatch — Avaliação em Lote

```
Busca MLTrainingPair (com opção de apenas sem score)
→ Para cada par: scoreResponse()
→ Atualiza qualityScore no banco
→ Retorna: { scored: number, avgScore: number }
```

#### compareResponses — Comparação A vs B

```
1. Avalia ambas em paralelo
2. Diferença < 5 pontos → "TIE"
3. Gera reasoning explicando qual dimensão foi decisiva
```

---

## 6. Training Pair Collector Service

**Arquivo:** `apps/api/src/services/ml/training-pair-collector.service.ts`

### Propósito

Coleta pares de treinamento **pergunta do cliente → resposta do atendente** de alta qualidade para alimentar o sistema de ML.

### Critérios de Coleta

```typescript
const DEFAULT_CRITERIA = {
  minResponseLength: 20,       // Resposta >= 20 caracteres
  maxResponseTime: 3600,       // Máximo 1 hora para responder
  requireResolved: false,      // Não exige ticket resolvido
  minRating: null,             // Sem rating mínimo
  excludeTemplateResponses: true, // Exclui respostas template
};
```

### Fontes de Coleta

#### 1. collectFromTicket — De um ticket específico

```
1. Busca todas as mensagens TEXT do ticket (ordem cronológica)
2. Para cada par consecutivo (mensagem[i], mensagem[i+1]):
   - mensagem[i] deve ser do CLIENTE (isFromMe = false)
   - mensagem[i+1] deve ser do ATENDENTE (isFromMe = true)
   - Atendente NÃO pode ser IA (isAI = false, isAIGenerated = false)
   - Resposta >= minResponseLength
   - Tempo de resposta <= maxResponseTime
   - Se excludeTemplateResponses: checa padrões de template
3. Verifica se atendente usou assistente IA (checkAIAssistance)
4. Retorna pares validados
```

#### 2. collectFromRecentTickets — De tickets recentes

```
1. Busca tickets com atividade nas últimas N horas (default: 24)
   - Filtro: humanTakeoverAt NOT NULL (teve atendimento humano)
   - Limite: 100 tickets
2. Para cada ticket:
   - Aplica filtro de rating se especificado
   - Chama collectFromTicket()
   - Salva cada par via saveTrainingPair()
```

#### 3. collectFromAITransfers — De transferências IA→Humano

Coleta especificamente os casos onde a IA **não conseguiu responder** e transferiu:

```
1. Busca TicketTransfer com transferType = 'AI_TO_HUMAN'
2. Para cada transferência:
   - Busca mensagens 5min antes e 30min depois da transferência
   - Encontra: última msg do cliente ANTES + primeira resposta humana DEPOIS
3. Salva o par (esses são especialmente valiosos para aprendizado)
```

### Salvamento (saveTrainingPair)

```
1. Verifica duplicata (por customerMessageId)
2. Gera embedding da pergunta do cliente
3. Detecta complexidade (SIMPLE | MEDIUM | COMPLEX)
4. Salva no MLTrainingPair com todos os metadados:
   - companyId, ticketId, customerQuery, agentResponse
   - customerEmbedding, complexity
   - wasAIAssisted, aiSuggestionUsed, aiSuggestionEdited
   - ticketResolved, customerRating, npsScore
```

### Detecção de Complexidade

```
SIMPLE:  <= 10 palavras E sem múltiplas perguntas E sem conjunções
COMPLEX: > 30 palavras OU múltiplas perguntas OU (conjunções + > 15 palavras)
MEDIUM:  tudo o que não é SIMPLE nem COMPLEX
```

### Detecção de Templates (looksLikeTemplate)

Padrões que indicam resposta automática:
- `^(olá|oi|bom dia|boa tarde|boa noite)[,!]?\s*$`
- `^obrigad[oa].*atendimento[.!]?\s*$`
- `^aguarde um momento`
- `^estamos verificando`
- `^vou transferir`

### Estatísticas (getStats)

Retorna em paralelo:
- Total de pares
- Pares validados
- Pares usados em treinamento
- Qualidade média
- Distribuição por categoria
- Distribuição por complexidade

---

## 7. ML Integration Service

**Arquivo:** `apps/api/src/services/ml/ml-integration.service.ts`

### Propósito

Fornece **hooks de eventos** que conectam o sistema de ML ao fluxo de atendimento. Todos os métodos são `static`.

### Hooks Disponíveis

#### onTicketResolved(ticketId, companyId)

Disparado quando um ticket é resolvido:
```
1. Verifica se ML está habilitado (companySettings.aiEnabled)
2. Agenda job de coleta de training pairs (BullMQ)
3. Tipo: 'collect-single-ticket'
```

#### onAIToHumanTransfer(ticketId, companyId, reason?)

Disparado quando a IA transfere para humano:
```
1. Verifica se ML está habilitado
2. Cria MLAIDecisionLog com decision = 'TRANSFER_TO_HUMAN'
```

#### onAISuggestionUsed(companyId, ticketId, suggestionId, wasEdited)

Disparado quando o atendente usa uma sugestão da IA:
```
1. Atualiza AIAssistantQuery: wasUsed = true, wasEdited, usedAt
2. Se NÃO foi editada → incrementa successCount dos templates da categoria
```

#### onTicketRated(ticketId, companyId, rating, npsScore?)

Disparado quando o cliente avalia o atendimento:
```
1. Busca AIAssistantQuery usadas neste ticket
2. Atualiza MLTrainingPair do ticket com rating e npsScore
3. Se rating >= 4 → incrementa successCount dos templates usados
```

#### logAIDecision(data)

Registra **toda decisão da IA** para auditoria:
```
Dados registrados no MLAIDecisionLog:
- customerMessage, messageEmbedding
- detectedIntent, intentConfidence
- detectedCategory, categoryConfidence
- decision: 'RESPOND_AI' | 'TRANSFER_TO_HUMAN' | 'SUGGEST_ONLY'
- decisionReason
- generatedResponse
- templateUsedId, documentsUsedIds
- qualityScore, processingTimeMs
```

#### updateDecisionOutcome(decisionLogId, outcome)

Atualiza o resultado de uma decisão:
```
- wasCorrectDecision: boolean
- humanOverride: boolean
- finalOutcome: string
```

#### updateDailyMetrics(companyId)

Calcula métricas diárias automaticamente:
```
1. Conta tickets do dia (total, AI-handled, humano)
2. Conta transferências AI→Humano
3. Calcula aiResolutionRate = aiHandledTickets / resolvedTickets * 100
4. Upsert em MLLearningMetric (por companyId + date)
```

---

## 8. Jobs Assíncronos (BullMQ)

### Filas de ML Definidas

| Fila | Helper | Tipos |
|------|--------|-------|
| `mlTrainingCollectorQueue` | `addMLTrainingCollectorJob()` | collect-recent, collect-transfers, collect-single-ticket |
| `mlQualityScorerQueue` | `addMLQualityScorerJob()` | score-pending, score-batch |
| `mlPatternDetectorQueue` | `addMLPatternDetectorJob()` | detect-patterns, train-intents, full-training |
| `mlMetricsQueue` | `addMLMetricsJob()` | calculate-daily, calculate-resolution-rate |

### Processor: mlTrainingCollectorProcessor

**Arquivo:** `apps/api/src/jobs/processors/ml-training-collector.processor.ts`

```
Fluxo:
1. Se companyId fornecido → processa apenas essa empresa
   Senão → busca todas empresas ativas com aiEnabled = true

2. Para cada empresa:
   a. Busca configurações (aiApiKey, aiProvider)
   b. Cria EmbeddingService + TrainingPairCollectorService

   c. Se tipo = 'collect-recent':
      - collectFromRecentTickets(hoursBack: 24, maxTickets: 100)
      - Critérios: minResponseLength: 20, maxResponseTime: 1800s

   d. Se tipo = 'collect-transfers':
      - Faz o acima + collectFromAITransfers(hoursBack: 24, maxTransfers: 50)

   e. Se tipo = 'collect-single-ticket':
      - collectFromTicket() + saveTrainingPair()

   f. Atualiza métricas diárias (newTrainingPairs)

3. Retorna: { collected, saved }
```

### Agendamento Planejado

| Job | Frequência | Horário |
|-----|-----------|---------|
| Coleta de training pairs | A cada hora | `0 * * * *` |
| Quality scoring | A cada 30 min | `*/30 * * * *` |
| Detecção de padrões | Diário | 2:00 AM |
| Treinamento de modelos | Semanal | Domingo 3:00 AM |
| FAQ automática | Diário | 4:00 AM |
| Métricas diárias | Diário | Meia-noite |

---

## 9. API Routes — ML Learning

**Arquivo:** `apps/api/src/routes/ml-learning.routes.ts`

Todas as rotas requerem `authenticate` + `ensureTenant`.

### Dashboard & Métricas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/ml-learning/dashboard` | Dashboard completo com métricas de 30 dias, training pairs stats, contadores de padrões e templates, gráfico 7 dias |

### Training Pairs

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/ml-learning/training-pairs` | Lista paginada com filtros (isValidated, usedInTraining, category, minQualityScore) |
| POST | `/api/ml-learning/training-pairs/:id/validate` | Valida um par (approved, category, intent) |
| POST | `/api/ml-learning/training-pairs/collect` | Dispara coleta manual (hoursBack, type) |

### Padrões de Intenção

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/ml-learning/patterns` | Lista padrões com filtros (category, isApproved, isActive) + responseTemplates |
| POST | `/api/ml-learning/patterns/:id/approve` | Aprova um padrão (registra approvedBy + approvedAt) |
| PUT | `/api/ml-learning/patterns/:id` | Atualiza padrão (name, keywords, examplePhrases, template, isActive) |
| POST | `/api/ml-learning/patterns/detect` | Dispara detecção de padrões (minOccurrences, minQualityScore) |

### Templates de Resposta

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/ml-learning/templates` | Lista templates com filtros (category, intent, isApproved, isActive) |
| POST | `/api/ml-learning/templates` | Cria template manual (name, category, intent, template, variables) — auto-aprovado |
| PUT | `/api/ml-learning/templates/:id` | Atualiza template (name, template, variables, isActive, isApproved) |
| DELETE | `/api/ml-learning/templates/:id` | Remove template |

### Geração de Respostas

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/ml-learning/generate-response` | Gera respostas candidatas (message, ticketId, category, intent, contactName, previousMessages, maxCandidates) |
| POST | `/api/ml-learning/classify-intent` | Classifica intenção de uma mensagem (message, previousMessages) |

### Treinamento & Jobs

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/ml-learning/train` | Treinamento completo (minOccurrences, minQualityScore, autoApprove) |
| POST | `/api/ml-learning/score-pairs` | Avaliação de qualidade dos pares (limit) |
| POST | `/api/ml-learning/calculate-metrics` | Cálculo de métricas (date) |

### Versões & Batches

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/ml-learning/model-versions` | Lista versões de modelos (modelType, isActive) |
| GET | `/api/ml-learning/training-batches` | Lista 20 batches mais recentes |

---

## 10. Modelos de Dados (Prisma)

### MLTrainingPair

Pares pergunta-resposta coletados do atendimento:

```
┌─────────────────────────────────────────────────────────┐
│ MLTrainingPair                                          │
├─────────────────────────────────────────────────────────┤
│ id                  String   (cuid)                     │
│ companyId           String   → Company                  │
│ ticketId            String   → Ticket                   │
│ customerMessageId   String   → Message                  │
│ customerQuery       String   (text normalizado)         │
│ customerEmbedding   Float[]  (vetor embedding)          │
│ agentMessageId      String   → Message                  │
│ agentResponse       String                              │
│ agentId             String   → User                     │
│ responseTime        Int      (segundos)                 │
│ wasAIAssisted       Boolean                             │
│ aiSuggestionUsed    Boolean?                            │
│ aiSuggestionEdited  Boolean?                            │
│ category            String?                             │
│ intent              String?                             │
│ complexity          MLComplexity (SIMPLE|MEDIUM|COMPLEX)│
│ ticketResolved      Boolean?                            │
│ customerRating      Int?     (1-5)                      │
│ npsScore            Int?     (0-10)                     │
│ firstContactResolution Boolean?                         │
│ qualityScore        Float?   (0-100)                    │
│ isValidated         Boolean  (default: false)           │
│ validatedBy         String?                             │
│ validatedAt         DateTime?                           │
│ usedInTraining      Boolean  (default: false)           │
│ trainingBatchId     String?                             │
└─────────────────────────────────────────────────────────┘
```

### MLIntentPattern

Padrões de intenção aprendidos ou manuais:

```
┌─────────────────────────────────────────────────────────┐
│ MLIntentPattern                                         │
├─────────────────────────────────────────────────────────┤
│ id                        String   (cuid)               │
│ companyId                 String   → Company            │
│ intent                    String   (ex: PRICE_INQUIRY)  │
│ category                  String   (ex: vendas)         │
│ name                      String   (nome amigável)      │
│ examplePhrases            String[] (até 20)             │
│ keywords                  String[]                      │
│ centroidEmbedding         Float[]  (centroide vetorial) │
│ suggestedResponseTemplate String?  (template sugerido)  │
│ occurrenceCount           Int      (default: 0)         │
│ successRate               Float?                        │
│ avgCustomerRating         Float?                        │
│ confidence                Float    (0-1)                │
│ isActive                  Boolean  (default: true)      │
│ isApproved                Boolean  (default: false)     │
│ approvedBy                String?                       │
│ approvedAt                DateTime?                     │
│ → responseTemplates       MLResponseTemplate[]          │
│ @@unique([companyId, intent])                           │
└─────────────────────────────────────────────────────────┘
```

### MLResponseTemplate

Templates de resposta (manuais ou aprendidos):

```
┌─────────────────────────────────────────────────────────┐
│ MLResponseTemplate                                      │
├─────────────────────────────────────────────────────────┤
│ id                  String   (cuid)                     │
│ companyId           String   → Company                  │
│ name                String                              │
│ category            String                              │
│ intent              String?  → MLIntentPattern          │
│ template            String   (com {{variáveis}})        │
│ variables           Json?    (descrição das variáveis)  │
│ templateEmbedding   Float[]  (embedding do template)    │
│ sourceType          String   (MANUAL|LEARNED|GENERATED) │
│ usageCount          Int      (default: 0)               │
│ successCount        Int      (default: 0)               │
│ avgRating           Float?                              │
│ isActive            Boolean  (default: true)            │
│ isApproved          Boolean  (default: false)           │
│ approvedBy          String?                             │
│ approvedAt          DateTime?                           │
└─────────────────────────────────────────────────────────┘
```

### MLModelVersion

Versionamento de modelos treinados:

```
┌─────────────────────────────────────────────────────────┐
│ MLModelVersion                                          │
├─────────────────────────────────────────────────────────┤
│ id                  String                              │
│ companyId           String   → Company                  │
│ version             String                              │
│ modelType           String   (INTENT_CLASSIFIER, etc.)  │
│ trainingPairsCount  Int                                 │
│ accuracy            Float?                              │
│ precision           Float?                              │
│ recall              Float?                              │
│ f1Score             Float?                              │
│ modelPath           String?  (caminho dos artefatos)    │
│ configJson          Json?                               │
│ status              String   (TRAINING|READY|DEPLOYED|  │
│                               DEPRECATED)               │
│ isActive            Boolean  (default: false)           │
│ deployedAt          DateTime?                           │
│ deprecatedAt        DateTime?                           │
└─────────────────────────────────────────────────────────┘
```

### MLLearningMetric

Métricas diárias de aprendizado por empresa:

```
┌─────────────────────────────────────────────────────────┐
│ MLLearningMetric                                        │
├─────────────────────────────────────────────────────────┤
│ id                       String                         │
│ companyId                String   → Company             │
│ date                     DateTime (Date)                │
│ totalTickets             Int                            │
│ aiHandledTickets         Int                            │
│ humanHandledTickets      Int                            │
│ aiToHumanTransfers       Int                            │
│ aiResolutionRate         Float    (%)                   │
│ aiAvgRating              Float?                         │
│ aiNpsScore               Float?                         │
│ newTrainingPairs         Int                            │
│ validatedPairs           Int                            │
│ newPatternsLearned       Int                            │
│ newTemplatesAdded        Int                            │
│ knowledgeGapsFound       Int                            │
│ aiResolutionRateDelta    Float?   (vs período anterior) │
│ @@unique([companyId, date])                             │
└─────────────────────────────────────────────────────────┘
```

### MLAIDecisionLog

Log de auditoria de todas as decisões da IA:

```
┌─────────────────────────────────────────────────────────┐
│ MLAIDecisionLog                                         │
├─────────────────────────────────────────────────────────┤
│ id                  String                              │
│ companyId           String   → Company                  │
│ ticketId            String                              │
│ messageId           String                              │
│ customerMessage     String                              │
│ messageEmbedding    Float[]                             │
│ detectedIntent      String?                             │
│ intentConfidence    Float?                              │
│ detectedCategory    String?                             │
│ categoryConfidence  Float?                              │
│ decision            String   (RESPOND_AI |              │
│                               TRANSFER_TO_HUMAN |       │
│                               SUGGEST_ONLY)             │
│ decisionReason      String?                             │
│ generatedResponse   String?                             │
│ templateUsedId      String?                             │
│ documentsUsedIds    String[]                            │
│ qualityScore        Float?                              │
│ processingTimeMs    Int                                 │
│ wasCorrectDecision  Boolean?                            │
│ humanOverride       Boolean?                            │
│ finalOutcome        String?                             │
└─────────────────────────────────────────────────────────┘
```

### MLTrainingBatch

Lotes de treinamento processados:

```
┌─────────────────────────────────────────────────────────┐
│ MLTrainingBatch                                         │
├─────────────────────────────────────────────────────────┤
│ id                  String                              │
│ companyId           String   → Company                  │
│ pairsCount          Int                                 │
│ patternsCreated     Int                                 │
│ patternsUpdated     Int                                 │
│ templatesCreated    Int                                 │
│ status              String                              │
│ error               String?                             │
│ startedAt           DateTime                            │
│ completedAt         DateTime?                           │
└─────────────────────────────────────────────────────────┘
```

---

## 11. Algoritmos e Fórmulas

### Similaridade de Cosseno

Usado em: Intent Classifier, Pattern Detector, Response Generator, Quality Scorer

```
             Σ(a[i] × b[i])
cos(a, b) = ─────────────────────────
             √(Σ(a[i]²)) × √(Σ(b[i]²))
```

### Cálculo de Centroide

Média aritmética dos embeddings do grupo:

```
centroid[i] = Σ(embedding[j][i]) / N    para cada dimensão i
```

### Normalização de Keywords Score

```
normalizedScore = matchedKeywords / √(totalKeywords)
```

A raiz quadrada evita penalizar padrões com muitas keywords — um padrão com 49 keywords que acerta 7 tem o mesmo score que um com 4 keywords que acerta 2.

### Confiança de Padrão Detectado

```
confidence = min(1, occurrenceCount / 20 + avgQualityScore / 100)
```

### Ranking de Respostas com Quality Score

```
finalConfidence = originalConfidence × 0.6 + qualityScore / 100 × 0.4
```

### Extração de Keywords

```
1. Tokeniza as frases (lowercase, remove pontuação)
2. Remove stopwords (67 palavras PT-BR)
3. Filtra palavras com < 3 caracteres
4. Conta frequência
5. Retorna palavras com frequência >= 30% das frases
6. Limite: 10 keywords
```

### Clustering Simplificado (Single-pass)

```
Para cada item:
  1. Calcula similaridade com centroide de cada cluster existente
  2. Se melhor similaridade > threshold (0.7):
     → Adiciona ao cluster existente
     → Recalcula centroide
  3. Se não:
     → Cria novo cluster
```

---

## 12. Ciclo de Aprendizagem Contínua

### Fluxo Completo

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CICLO DE ML                                      │
│                                                                               │
│   ATENDIMENTO                                                                │
│   ───────────                                                                │
│   1. Cliente envia mensagem                                                  │
│   2. IntentClassifier → classificação de intenção                           │
│   3. ResponseGenerator → gera candidatos de resposta                        │
│   4. QualityScorer → ranqueia candidatos                                    │
│   5. Se confiança >= threshold → IA responde                                │
│      Se não → transfere para humano                                          │
│                                                                               │
│   COLETA DE DADOS                                                            │
│   ────────────────                                                           │
│   6. MLIntegration.onTicketResolved() → agenda coleta                       │
│   7. TrainingPairCollector → extrai pares (pergunta, resposta)              │
│   8. EmbeddingService → gera embeddings das perguntas                       │
│   9. QualityScorer.scoreBatch() → pontua qualidade dos pares                │
│                                                                               │
│   APRENDIZADO                                                                │
│   ────────────                                                               │
│   10. PatternDetector → detecta novos padrões                               │
│   11. IntentClassifier.trainFromTrainingPairs() → treina classificador      │
│   12. PatternDetector.extractTemplate() → extrai templates                   │
│   13. Admin aprova novos padrões e templates                                 │
│                                                                               │
│   FEEDBACK LOOP                                                              │
│   ──────────────                                                             │
│   14. MLIntegration.onAISuggestionUsed() → registra uso                     │
│   15. MLIntegration.onTicketRated() → atualiza métricas                     │
│   16. ResponseGenerator.recordResponseUsage() → incrementa contadores       │
│   17. MLIntegration.updateDailyMetrics() → métricas consolidadas            │
│                                                                               │
│   RESULTADO: IA progressivamente mais autônoma                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Evolução Esperada

```
Semana 1:  IA resolve ~20% dos tickets  │████
Semana 4:  IA resolve ~35% dos tickets  │███████
Semana 8:  IA resolve ~50% dos tickets  │██████████
Semana 16: IA resolve ~60%+ dos tickets │████████████
```

---

## 13. Configurações e Thresholds

### Thresholds Globais

| Parâmetro | Valor | Onde é usado |
|-----------|-------|-------------|
| `confidenceThreshold` | 0.7 | Intent Classifier — mínimo para aceitar classificação |
| `minConfidenceThreshold` | 0.6 | Response Generator — mínimo para aceitar resposta |
| `similarityThreshold` | 0.75 | Pattern Detector — mínimo para clustering |
| `useLLMFallback` | true | Intent Classifier — usar LLM quando baixa confiança |
| `maxCandidates` | 3 | Response Generator — máximo de respostas candidatas |
| `enableQualityScoring` | true | Response Generator — usar QualityScorer no ranking |

### Critérios de Coleta

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `minResponseLength` | 20 | Caracteres mínimos na resposta do atendente |
| `maxResponseTime` | 1800s | Máximo 30 minutos (no job) ou 3600s (default) |
| `excludeTemplateResponses` | true | Excluir respostas que parecem templates |
| `hoursBack` | 24 | Janela de tempo para coleta |
| `maxTickets` | 100 | Máximo de tickets por rodada de coleta |
| `maxTransfers` | 50 | Máximo de transferências por rodada |

### Parâmetros de Treinamento

| Parâmetro | Valor Default | Descrição |
|-----------|---------------|-----------|
| `minOccurrences` | 5 | Mínimo de pares para criar padrão |
| `minQualityScore` | 70 | Quality score mínimo para usar em treinamento |
| `minClusterSize` | 5 | Mínimo de itens para formar um cluster |
| `autoApprove` | false | Auto-aprovar padrões detectados |

### Pesos do Quality Score

| Dimensão | Peso |
|----------|------|
| Relevância | 30% |
| Completude | 25% |
| Factualidade | 20% |
| Clareza | 15% |
| Tom | 10% |

### LLM Parameters

| Contexto | Temperature | Max Tokens |
|----------|-------------|------------|
| Intent Classification | 0.2 | 300 |
| Template Extraction | 0.3 | 500 |
| Quality Scoring | 0.3 | 200 |
| Response Generation | 0.7 (ou config do agent) | 500 (ou config do agent) |

### Multi-Tenancy

- Todos os dados são isolados por `companyId`
- Cada empresa tem seus próprios padrões, templates e modelos
- A habilitação é controlada por `companySettings.aiEnabled`
- As credenciais de IA são por empresa: `companySettings.aiApiKey` + `aiProvider`
