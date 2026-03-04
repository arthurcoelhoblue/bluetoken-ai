

## Diagnóstico Definitivo do Copilot — Root Cause Found

### O Que Acontece (Passo a Passo)

1. Frontend envia POST para `copilot-chat` com streaming
2. Edge function leva ~4-5s no enriquecimento (CRM + coaching RAG)
3. Edge function chama Anthropic com `stream: true` e proxy SSE para o frontend
4. O streaming funciona por uns segundos, mas o **Supabase mata a edge function no limite de 30s**
5. O stream é cortado abruptamente no meio da resposta
6. O frontend detecta o corte via watchdog de 30s de inatividade, dispara `AbortError`
7. O fallback `catch` envia uma segunda requisição com `{ stream: false }` no body
8. **A edge function IGNORA o campo `stream: false`** — ela sempre tenta streaming
9. **O frontend tenta `fallbackResp.json()` na resposta SSE** — falha silenciosamente
10. Resultado: mensagem de timeout, resposta perdida

### Os 2 Bugs Raiz

**Bug A: Edge function não respeita `stream: false`**

O `index.ts` da edge function nunca lê o parâmetro `stream` do body. Ele sempre tenta o path de streaming Anthropic primeiro. Quando o frontend envia o fallback non-streaming, a edge function retorna SSE de novo.

**Bug B: Frontend tenta JSON.parse() em resposta SSE**

No catch de AbortError (CopilotPanel.tsx linha 256-276), o fallback faz `fallbackResp.json()`. Mas como a edge function retorna SSE (`text/event-stream`), o `.json()` falha e o catch interno engole o erro silenciosamente.

### Consequência Cascata

Enrichment (4-5s) + Coaching RAG (até 4s) = **8-9s consumidos** antes de chamar o modelo. Sobram apenas **21-22s** dos 30s de limite da edge function para o streaming completo. Se o Claude demora, o stream é cortado.

### Plano de Correção

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `copilot-chat/index.ts` | Ler `stream` do body (default `true`). Quando `false`, pular streaming Anthropic e ir direto ao fallback `callAI`, retornando JSON puro |
| 2 | `copilot-chat/index.ts` | Reduzir `anthropicTimeout` de 20s → 18s para ter margem |
| 3 | `CopilotPanel.tsx` | No fallback non-streaming, ler a resposta como SSE (mesma lógica do stream) em vez de `.json()` — OU — verificar `Content-Type` e parsear adequadamente |
| 4 | `CopilotPanel.tsx` | Reduzir `streamStartTimeout` de 25s → 20s (não adianta esperar mais que o limite da edge function) |

### Mudanças Específicas

**Edge Function (`index.ts`):**
```typescript
// Linha 97 — extrair stream do body
const { messages, contextType, contextId, empresa, stream = true } = await req.json();

// Linha 267 — só tentar streaming se stream !== false
if (ANTHROPIC_KEY && stream !== false) {
  // ... streaming path existente
}

// Linha 421 — fallback retorna JSON quando stream=false
if (stream === false) {
  return new Response(JSON.stringify({
    choices: [{ message: { content: aiResult.content } }],
    meta: { model: aiResult.model, ... }
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

**Frontend (`CopilotPanel.tsx`):**
```typescript
// No fallback, parsear como JSON (agora o backend vai retornar JSON)
const fallbackData = await fallbackResp.json();
const fallbackContent = fallbackData.choices?.[0]?.message?.content || '';
```

Estas 4 mudanças corrigem o ciclo completo: streaming funciona quando possível, fallback non-streaming funciona quando o streaming falha.

