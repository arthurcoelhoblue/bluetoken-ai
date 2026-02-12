

# Avaliacao de Qualidade: Gemini 3 Pro Preview vs Claude Sonnet 4

## Situacao Atual

- 100% das 346 interpretacoes usam `claude-sonnet-4-20250514`
- Confianca media: 85.9%
- Tempo medio: 8.488ms
- Tokens medios: 7.775
- Nenhuma chamada Gemini ainda registrada

## Proposta: Teste de Reprocessamento (Shadow Test)

Criar uma edge function dedicada que reprocessa mensagens historicas com o Gemini 3 Pro Preview e salva os resultados em uma tabela separada para comparacao, sem afetar a operacao real.

### 1. Criar tabela de benchmark

Nova tabela `ai_model_benchmarks` com colunas:
- `id` (uuid)
- `original_intent_id` (referencia ao lead_message_intents original)
- `modelo_ia` (modelo testado)
- `intent` (intent detectado pelo modelo de teste)
- `intent_confidence` (confianca do modelo de teste)
- `acao_recomendada` (acao sugerida)
- `resposta_automatica_texto` (resposta gerada)
- `tokens_usados`, `tempo_processamento_ms`
- `created_at`

### 2. Criar edge function `ai-benchmark`

Funcao que:
- Recebe parametros: quantidade de mensagens a testar, modelo alvo
- Busca N mensagens recentes do `lead_messages` (INBOUND)
- Para cada mensagem, monta o mesmo contexto que o `sdr-ia-interpret` usaria
- Chama o modelo via `tryGoogleDirect()` com o mesmo prompt
- Salva o resultado na tabela de benchmark
- Retorna um resumo comparativo

### 3. Criar pagina de comparacao na UI

Nova pagina `/admin/ai-benchmark` com:
- Botao para iniciar benchmark (selecionar modelo e quantidade)
- Tabela comparativa mostrando lado a lado:
  - Mensagem original do lead
  - Intent detectado (Claude vs Gemini)
  - Confianca (Claude vs Gemini)
  - Acao recomendada (comparacao)
  - Resposta gerada (comparacao)
  - Tempo e tokens (comparacao)
- Metricas agregadas:
  - Taxa de concordancia de intent
  - Diferenca media de confianca
  - Diferenca de tempo e custo
- Destaque em vermelho quando os modelos discordam no intent ou na acao

### 4. Alternativa mais simples (recomendada para comecar)

Se preferir algo mais rapido, posso criar apenas:
- Uma query que busca as ultimas 20 mensagens inbound
- Reprocessa com Gemini 3 Pro via a edge function existente (modo dry-run)
- Exibe os resultados em uma tabela simples na tela de Settings > IA

## Detalhes Tecnicos

### Tabela SQL

```text
CREATE TABLE ai_model_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_intent_id uuid REFERENCES lead_message_intents(id),
  message_id uuid REFERENCES lead_messages(id),
  modelo_ia text NOT NULL,
  intent text,
  intent_confidence numeric(4,2),
  acao_recomendada text,
  resposta_automatica_texto text,
  tokens_usados integer,
  tempo_processamento_ms integer,
  created_at timestamptz DEFAULT now()
);
```

### Edge function `ai-benchmark`

- Reutiliza a logica de montagem de contexto do `sdr-ia-interpret`
- Chama apenas o modelo alvo (sem fallback)
- Nao aplica acoes (modo somente leitura)
- Retorna array de resultados + metricas agregadas

### Pagina UI

- Acessivel apenas para ADMIN
- Rota: `/admin/ai-benchmark`
- Componentes: tabela comparativa, cards de metricas, botao de execucao

## Sequencia de Execucao

1. Criar tabela `ai_model_benchmarks` via migration
2. Criar edge function `ai-benchmark`
3. Criar pagina UI com tabela comparativa
4. Adicionar rota no App.tsx e link no sidebar
5. Executar benchmark com 20-30 mensagens e avaliar resultados

