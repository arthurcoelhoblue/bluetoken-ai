

# Plano 11/10 — Implementacao Completa

Cinco frentes de trabalho para fechar todas as lacunas e elevar o sistema para 11/10.

---

## Frente 1: Camada Compartilhada `_shared/ai-provider.ts`

O arquivo ja foi criado na rodada anterior com a interface `callAI()`. Agora precisa ser refinado para ser usado como piloto em `cs-suggest-note` (ja feito) e `copilot-chat`.

### Arquivo: `supabase/functions/copilot-chat/index.ts` (902 linhas)

Remover as funcoes locais `callGemini()` e `callClaude()` (linhas 57-111) e o bloco de fallback manual (linhas 260-325). Substituir por `import { callAI } from "../_shared/ai-provider.ts"` e uma unica chamada `callAI()` com `messages` array.

O enriquecimento de contexto (linhas 224-250) e A/B testing de prompts (linhas 133-161) permanecem intactos — apenas a camada de chamada IA muda.

---

## Frente 2: Telemetria 100% (3 funcoes faltantes)

### `supabase/functions/amelia-learn/index.ts` (470 linhas)

A funcao usa `callAI()` local (linhas 9-82) para analise de sequencias de perda/churn (linhas 315-357 e 388-431). Nao loga em `ai_usage_log`. Adicionar logging apos cada chamada de IA com `function_name: 'amelia-learn'`.

### `supabase/functions/amelia-mass-action/index.ts` (288 linhas)

Gera mensagens personalizadas via Claude/Gemini/GPT (linhas 183-253) para cada deal, mas nao loga. Adicionar `ai_usage_log.insert()` apos cada geracao bem-sucedida com `function_name: 'amelia-mass-action'`.

### `supabase/functions/ai-benchmark/index.ts`

Processa mensagens com Claude/Gemini/GPT (linhas ~85-140) para benchmark, mas nao loga. Adicionar `ai_usage_log.insert()` dentro do loop apos cada chamada.

---

## Frente 3: Enriquecer `sdr-intent-classifier` com logica do monolito

O classificador atual (112 linhas) tem um prompt generico. Precisa absorver:

- Tabelas de preco Blue (`BLUE_PRICING`, linhas 567-609)
- Conhecimento Tokeniza (`TOKENIZA_KNOWLEDGE`, linhas 615-729)
- Formatadores: `formatBluePricingForPrompt()`, `formatTokenizaKnowledgeForPrompt()`, `formatTokenizaOffersForPrompt()`
- Knowledge base de produtos: `fetchProductKnowledge()`, `formatProductKnowledgeForPrompt()`
- Logica de `computeClassificationUpgrade()` (linhas 113-150)
- Normalizacao de frameworks: `normalizeFrameworkKeys()`, `normalizeSubKeys()`
- A/B testing de prompts (buscar `prompt_versions` ativas)
- Sistema de fallback com retry e backoff exponencial (linhas 2692-2871)
- Prompt completo (`SYSTEM_PROMPT` de ~100 linhas, linhas 1903-2018)
- Cross-selling detection: `detectCrossCompanyInterest()`
- Ofertas Tokeniza ativas: `fetchActiveTokenizaOffers()`
- Aprendizados validados da Amelia: busca `amelia_learnings`
- Decisao de proxima pergunta: toda a logica `decidirProximaPergunta()` + `decidirProximaPerguntaBLUE()` + `decidirProximaPerguntaTOKENIZA()`
- Instrucoes de perfil DISC: `getDiscToneInstruction()`
- Perfil investidor: `formatInvestorProfileExamples()`
- Regras de canal: `CHANNEL_RULES`
- Logica de validacao CTA: `validarCTAReuniao()`
- Matriz de temperatura: `computeNewTemperature()`
- Inferencia SPIN/GPCT/BANT
- Estados de conversa e funil

Resultado: o `sdr-intent-classifier` tera ~2000 linhas (absorvendo toda a inteligencia de classificacao + prompt building do monolito).

---

## Frente 4: Reescrever `sdr-ia-interpret` como orquestrador

O monolito atual (4.285 linhas) sera substituido por um orquestrador de ~250 linhas que:

1. Recebe `{ messageId, source, mode, triageSummary }`
2. Busca a mensagem por `messageId` (query simples)
3. Verifica opt-out, duplicata, modo MANUAL (retornos rapidos)
4. Chama `sdr-message-parser` via fetch interno -> retorna contexto completo
5. Chama `sdr-intent-classifier` via fetch interno -> retorna intent, frameworks, temperatura
6. Chama `sdr-response-generator` via fetch interno -> retorna resposta sanitizada
7. Chama `sdr-action-executor` via fetch interno -> executa acoes
8. Salva interpretacao em `lead_message_intents`
9. Retorna resultado final

Cada chamada interna usa `fetch(SUPABASE_URL/functions/v1/nome-funcao)` com `Authorization: Bearer SERVICE_ROLE_KEY`.

A funcao `saveInterpretation()` (linhas 3644-3762) permanece no orquestrador pois e o ponto central de persistencia.

---

## Frente 5: Enriquecer funcoes modulares existentes

### `sdr-message-parser` (ja enriquecido na rodada anterior)

Ja absorveu `loadMessageContext()`, deteccao de urgencia, perfil investidor. Verificar se esta completo.

### `sdr-response-generator` (ja enriquecido na rodada anterior)

Ja absorveu sanitizacao anti-robo e regras de canal. Verificar se esta completo.

### `sdr-action-executor` (ja enriquecido na rodada anterior)

Ja absorveu `applyAction()`, `sendAutoResponse()`, `syncWithPipedrive()`, `updatePessoaDISC()`, `saveConversationState()`. Verificar se esta completo.

---

## Resumo de arquivos

### Modificados (6 arquivos)

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/sdr-ia-interpret/index.ts` | Reescrever de 4.285 para ~250 linhas (orquestrador) |
| `supabase/functions/sdr-intent-classifier/index.ts` | Expandir de 112 para ~2000 linhas (absorver prompts, precos, frameworks, A/B testing) |
| `supabase/functions/copilot-chat/index.ts` | Substituir callClaude/callGemini/GPT por `callAI()` da camada compartilhada |
| `supabase/functions/amelia-learn/index.ts` | Adicionar `ai_usage_log.insert()` apos chamadas IA |
| `supabase/functions/amelia-mass-action/index.ts` | Adicionar `ai_usage_log.insert()` apos cada geracao |
| `supabase/functions/ai-benchmark/index.ts` | Adicionar `ai_usage_log.insert()` apos cada benchmark |

### Ordem de execucao

1. `copilot-chat` refatorado com `callAI()` (piloto da camada compartilhada)
2. Telemetria nas 3 funcoes faltantes (`amelia-learn`, `amelia-mass-action`, `ai-benchmark`)
3. `sdr-intent-classifier` enriquecido com toda a logica de classificacao do monolito
4. `sdr-ia-interpret` reescrito como orquestrador fino

---

## Detalhamento tecnico do orquestrador

```text
POST /sdr-ia-interpret { messageId, source, mode, triageSummary }
  |
  v
[1] Buscar mensagem por messageId (lead_messages)
    Verificar: opt-out? ja interpretado? modo MANUAL?
    (retorno rapido se sim)
  |
  v
[2] fetch(/sdr-message-parser, { lead_id, empresa, messageId })
    -> { historico, classificacao, urgencia, deals, contato,
         conversation_state, pessoaContext, telefone, optOut,
         cadenciaNome, pipedriveDealeId }
  |
  v
[3] fetch(/sdr-intent-classifier, { mensagem, empresa, contexto_parsed,
         mode, triageSummary })
    -> { intent, confidence, temperatura, sentimento,
         framework_updates, acao_recomendada, resposta_sugerida,
         novo_estado_funil, disc_estimado, deve_responder,
         model, provider }
  |
  v
[4] fetch(/sdr-response-generator, { resposta_sugerida, leadNome,
         empresa, canal, intent })
    -> { resposta_sanitizada, was_robotic }
  |
  v
[5] fetch(/sdr-action-executor, { lead_id, run_id, empresa, acao,
         detalhes, telefone, resposta, source })
    -> { acaoAplicada, respostaEnviada, actions_executed[] }
  |
  v
[6] Salvar em lead_message_intents + ai_usage_log
[7] Retornar resultado final
```

