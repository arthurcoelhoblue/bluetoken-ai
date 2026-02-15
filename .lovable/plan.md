
# Plano 11/10 -- Fechar TODAS as Lacunas Restantes

Tres frentes de trabalho para elevar o sistema de 9.0 para 11/10: refatorar o monolito SDR-IA em orquestrador, criar camada compartilhada de IA, e atingir 100% de cobertura de telemetria.

---

## Frente 1: SDR-IA Orquestrador (~200 linhas)

O `sdr-ia-interpret/index.ts` tem 4.285 linhas. As 4 funcoes modulares (`sdr-message-parser`, `sdr-intent-classifier`, `sdr-response-generator`, `sdr-action-executor`) ja existem e estao deployadas, mas **nao sao chamadas por ninguem**. O monolito continua fazendo tudo sozinho.

**Acao**: Reescrever `sdr-ia-interpret/index.ts` como orquestrador fino que:
1. Recebe `messageId` (e `source`, `mode`, `triageSummary`)
2. Carrega a mensagem + verifica opt-out + verifica duplicata + verifica modo MANUAL (logica leve, ~100 linhas)
3. Chama `sdr-message-parser` via fetch interno para parsear contexto
4. Chama `sdr-intent-classifier` passando o contexto parsed
5. Chama `sdr-response-generator` passando intent + contexto
6. Chama `sdr-action-executor` passando acoes recomendadas
7. Salva interpretacao em `lead_message_intents`
8. Envia resposta via `whatsapp-send` ou retorna ao Blue Chat
9. Sincroniza Pipedrive em background
10. Retorna resultado final

**Preservar**: Toda a logica de negocio complexa (urgencia, DISC, precos, conhecimento de produto, qualificacao consultiva, anti-limbo patches) sera movida para dentro das 4 funcoes modulares, que precisam ser enriquecidas com a logica que hoje vive apenas no monolito.

### Detalhamento tecnico

| Arquivo | Acao |
|---------|------|
| `supabase/functions/sdr-ia-interpret/index.ts` | Reescrever: de 4.285 linhas para ~250 linhas (orquestrador) |
| `supabase/functions/sdr-message-parser/index.ts` | Enriquecer: absorver `loadMessageContext()`, `detectarLeadQuenteImediato()`, `detectarLeadProntoParaEscalar()`, `inferirPerfilInvestidor()`, tipos e constantes de urgencia |
| `supabase/functions/sdr-intent-classifier/index.ts` | Enriquecer: absorver `interpretWithAI()`, prompts gigantes por empresa/canal, logica de SPIN/GPCT/BANT, `computeClassificationUpgrade()`, A/B testing de prompts, tabelas de preco Blue e conhecimento Tokeniza |
| `supabase/functions/sdr-response-generator/index.ts` | Enriquecer: absorver `sanitizeRoboticResponse()`, `detectRoboticPattern()`, regras anti-limbo, variacoes de transicao, exemplos por perfil investidor, regras de canal |
| `supabase/functions/sdr-action-executor/index.ts` | Enriquecer: absorver `applyAction()`, `sendAutoResponse()`, `saveInterpretation()`, sincronizacao Pipedrive, `updatePessoaDISC()`, `saveConversationState()` |

### Fluxo do orquestrador

```text
POST /sdr-ia-interpret { messageId, source, mode, triageSummary }
  |
  v
[1] Buscar mensagem por messageId (lead_messages)
[2] Verificar: opt-out? ja interpretado? modo MANUAL?
  |  (retorno rapido se sim)
  v
[3] POST /sdr-message-parser { lead_id, empresa, mensagem, canal }
  |  -> Retorna: contexto completo (historico, classificacao, urgencia, deals, contato, conversation_state)
  v
[4] POST /sdr-intent-classifier { ...contexto_parsed }
  |  -> Retorna: intent, confidence, temperatura, sentimento, framework_updates, acao_recomendada
  v
[5] POST /sdr-response-generator { intent, contexto, ... }
  |  -> Retorna: resposta_texto, model, provider
  v
[6] POST /sdr-action-executor { lead_id, acao, intent, ... }
  |  -> Retorna: actions_executed[]
  v
[7] Salvar interpretacao + enviar resposta + sync Pipedrive
[8] Retornar resultado
```

---

## Frente 2: Camada Compartilhada de IA (`_shared/ai-provider.ts`)

Criar arquivo utilitario reutilizavel que elimina duplicacao de logica Claude/Gemini/GPT em todas as funcoes.

| Arquivo | Acao |
|---------|------|
| `supabase/functions/_shared/ai-provider.ts` | Criar: funcao `callAI(system, prompt, opts)` com hierarquia Claude -> Gemini -> GPT-4o, logging automatico em `ai_usage_log` |

**Interface**:
```text
callAI({
  system: string,
  prompt: string,
  functionName: string,
  empresa?: string,
  temperature?: number,
  maxTokens?: number,
  promptVersionId?: string,
  supabase: SupabaseClient
}) -> { content: string, model: string, provider: string, tokensInput: number, tokensOutput: number, latencyMs: number }
```

**Pilotos de refatoracao**: Refatorar `cs-suggest-note` e `copilot-chat` para usar `callAI()` em vez de logica duplicada.

---

## Frente 3: Telemetria 100% (funcoes que faltam)

Funcoes que usam IA mas NAO logam em `ai_usage_log`:

| Funcao | Usa IA? | Tem log? | Acao |
|--------|---------|----------|------|
| `amelia-learn` | Sim (Claude/Gemini/GPT) | Nao | Adicionar |
| `amelia-mass-action` | Sim (Claude/Gemini/GPT) | Nao | Adicionar |
| `ai-benchmark` | Sim (Claude/Gemini/GPT) | Nao | Adicionar |

Total: 3 funcoes sem telemetria. Adicionar `ai_usage_log.insert()` em cada uma apos a chamada de IA.

---

## Resumo de Arquivos

### Modificados (8 arquivos)

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/sdr-ia-interpret/index.ts` | Reescrever como orquestrador de ~250 linhas |
| `supabase/functions/sdr-message-parser/index.ts` | Enriquecer com logica completa de contexto + urgencia + perfil investidor |
| `supabase/functions/sdr-intent-classifier/index.ts` | Enriquecer com prompts completos, precos, conhecimento, A/B testing, classification upgrade |
| `supabase/functions/sdr-response-generator/index.ts` | Enriquecer com sanitizacao, anti-limbo, regras de canal, variacoes |
| `supabase/functions/sdr-action-executor/index.ts` | Enriquecer com applyAction, sendAutoResponse, saveInterpretation, Pipedrive sync, DISC update |
| `supabase/functions/amelia-learn/index.ts` | Adicionar ai_usage_log |
| `supabase/functions/amelia-mass-action/index.ts` | Adicionar ai_usage_log |
| `supabase/functions/ai-benchmark/index.ts` | Adicionar ai_usage_log |

### Novos (1 arquivo)

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/_shared/ai-provider.ts` | Camada unificada de IA com fallback chain + telemetria automatica |

### Refatorados como piloto (2 arquivos)

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/cs-suggest-note/index.ts` | Usar `callAI()` da camada compartilhada |
| `supabase/functions/copilot-chat/index.ts` | Usar `callAI()` para chamadas Claude/Gemini/GPT (manter enriquecimento de contexto) |

---

## Ordem de execucao

1. Criar `_shared/ai-provider.ts`
2. Enriquecer as 4 funcoes modulares SDR com toda a logica do monolito
3. Reescrever `sdr-ia-interpret` como orquestrador
4. Adicionar telemetria nas 3 funcoes faltantes
5. Refatorar `cs-suggest-note` e `copilot-chat` como pilotos do `callAI()`
