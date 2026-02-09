
# Plano de Melhorias Criticas do SDR IA

## 1. Retry com Backoff Exponencial nas Chamadas IA

### Onde: `supabase/functions/sdr-ia-interpret/index.ts`

Atualmente, cada provedor de IA (Anthropic, Gemini, GPT) e tentado uma unica vez. Se falhar por timeout ou erro transitorio (429, 503, etc.), ja pula para o proximo provedor.

**Melhoria:** Adicionar retry com backoff exponencial DENTRO de cada provedor antes de pular para o proximo.

- Criar funcao `withRetry(fn, maxRetries=2, baseDelayMs=1000)` que:
  - Tenta executar a funcao
  - Em caso de erro transitorio (429, 500, 502, 503, 504, timeout), espera `baseDelay * 2^tentativa` ms
  - Para erros definitivos (401, 403, 402), nao faz retry
  - Max 2 retries por provedor (total 3 tentativas por provedor)
- Aplicar nos metodos `tryAnthropic` e `tryLovableAI` (linhas ~2874-2975)

### Onde: `supabase/functions/whatsapp-inbound/index.ts`

A chamada ao `sdr-ia-interpret` (linhas 574-595) tambem nao tem retry.

**Melhoria:** Adicionar retry simples com 2 tentativas e delay de 2s entre elas para a chamada fetch ao sdr-ia-interpret.

### Onde: `supabase/functions/bluechat-inbound/index.ts`

Mesma situacao na funcao `callSdrIaInterpret` (linhas ~280-310).

**Melhoria:** Mesmo padrao de retry.

---

## 2. Transacao Atomica para Estado de Conversa

### Onde: Migration SQL (nova)

Criar RPC `update_conversation_with_intent` que executa em uma unica transacao:
1. Upsert em `lead_conversation_state` (estado_funil, framework_data, perfil_disc)
2. Insert em `lead_message_intents` (interpretacao da IA)
3. Update em `lead_cadence_runs` (se acao for pausar/cancelar)

Parametros: lead_id, empresa, canal, intent_data (JSON), state_updates (JSON), cadence_action (TEXT)

### Onde: `supabase/functions/sdr-ia-interpret/index.ts`

Refatorar os passos 4-7 (linhas ~3737-3878) para chamar a RPC ao inves de fazer 3 operacoes separadas. Manter fallback para o comportamento atual caso a RPC falhe.

---

## 3. Score de Completude dos Frameworks com Alerta

### Onde: `supabase/functions/sdr-ia-interpret/index.ts`

Apos salvar interpretacao (passo 6), calcular score de completude do framework ativo:
- Contar campos preenchidos vs total (4 campos por framework)
- Se completude < 25% E numero de mensagens INBOUND do lead >= 5, registrar evento `ALERTA_FRAMEWORK_INCOMPLETO` em `lead_cadence_events`
- Logar warning no console

### Onde: `src/components/conversation/ConversationStateCard.tsx`

Ja existe a barra de progresso com `getFrameworkCompleteness`. Adicionar:
- Indicador visual de alerta quando completude < 25% (icone AlertTriangle + texto amarelo)
- Tooltip explicando que o framework precisa de mais dados

---

## 4. Estados de Loading e Erro Consistentes na UI

### Componentes a revisar e melhorar:

**`src/components/messages/ConversationView.tsx`** - Verificar se tem skeleton/error
**`src/components/intents/IntentHistoryCard.tsx`** - Verificar se tem skeleton/error
**`src/components/leads/ContactIssuesCard.tsx`** - Verificar se tem skeleton/error

**`src/components/conversation/ConversationStateCard.tsx`** - Ja tem loading/empty state (OK)
**`src/components/pessoa/PessoaCard.tsx`** - Ja tem loading/empty state (OK)

Para cada componente que faltar, adicionar:
- `if (isLoading) return <Skeleton />` com formato adequado
- `if (error) return <Card com mensagem de erro e botao retry>`

---

## Detalhes Tecnicos

### Funcao de Retry (reutilizavel nas edge functions)

```text
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;      // default: 2
    baseDelayMs?: number;     // default: 1000
    retryableStatuses?: number[]; // default: [429, 500, 502, 503, 504]
  }
): Promise<T>
```

### RPC SQL

```text
CREATE OR REPLACE FUNCTION update_conversation_with_intent(
  p_lead_id UUID,
  p_empresa TEXT,
  p_canal TEXT,
  p_intent_data JSONB,
  p_state_updates JSONB,
  p_cadence_action TEXT DEFAULT NULL,
  p_cadence_run_id UUID DEFAULT NULL
) RETURNS JSONB
```

### Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/sdr-ia-interpret/index.ts` | Retry nos provedores IA + uso da RPC atomica |
| `supabase/functions/whatsapp-inbound/index.ts` | Retry na chamada ao sdr-ia-interpret |
| `supabase/functions/bluechat-inbound/index.ts` | Retry na chamada ao sdr-ia-interpret |
| Migration SQL | RPC `update_conversation_with_intent` |
| `src/components/conversation/ConversationStateCard.tsx` | Alerta de framework incompleto |
| `src/components/messages/ConversationView.tsx` | Loading/error states (se necessario) |
| `src/components/intents/IntentHistoryCard.tsx` | Loading/error states (se necessario) |

### Ordem de Implementacao

1. Migration SQL (RPC atomica)
2. Edge functions (retry + RPC)
3. UI (alertas + loading/error)
