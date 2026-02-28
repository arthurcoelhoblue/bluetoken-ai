

# Respostas mais rápidas no Copilot Chat

## Diagnóstico
O copilot hoje espera a resposta COMPLETA da IA antes de mostrar qualquer coisa ao usuário. Com respostas de 200-500 tokens, isso significa 3-8 segundos de tela de "bolinhas pulando". Além disso, o enriquecimento de contexto faz múltiplas queries sequenciais ao banco antes de chamar a IA.

## Solução: Streaming token-a-token + paralelização

### 1. `supabase/functions/copilot-chat/index.ts` — Streaming SSE
- Em vez de usar `callAI()` (que retorna tudo de uma vez), chamar a API do Claude Haiku diretamente com `stream: true`
- Retornar `Response` com `Content-Type: text/event-stream` e fazer pipe do stream da Anthropic
- Manter o fallback para Gemini/GPT-4o (sem streaming) caso Claude falhe
- Fazer log de telemetria no `ai_usage_log` ao final do stream

### 2. `src/components/copilot/CopilotPanel.tsx` — Renderização progressiva
- Substituir `supabase.functions.invoke()` por `fetch()` com leitura de SSE
- Renderizar tokens conforme chegam (atualizar última mensagem assistant progressivamente)
- Mostrar o primeiro token em ~300ms em vez de esperar 3-8s

### 3. `src/hooks/useCopilotMessages.ts` — Salvar ao final do stream
- Salvar mensagem assistant no DB apenas quando o stream terminar (não a cada token)

### Fluxo resultante

```text
Usuário envia mensagem
    │
    ├── Salva msg user no DB
    ├── fetch() com SSE para copilot-chat
    │     ├── Backend: enriquece contexto (queries paralelas — já existente)
    │     ├── Backend: chama Claude Haiku com stream:true
    │     └── Backend: pipe dos tokens via SSE
    │
    ├── Frontend: renderiza cada token ao chegar (~300ms pro primeiro)
    └── Ao [DONE]: salva resposta completa no DB
```

### Impacto esperado
- **Tempo até primeiro token**: de ~5s para ~0.5s
- **Percepção de velocidade**: resposta aparece "instantaneamente" e vai sendo escrita

