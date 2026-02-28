

# Simplificar: Usar transcrição nativa do Zadarma

## Situação atual (ineficiente)
1. `NOTIFY_RECORD` chega com `call_id_with_rec`
2. `call-transcribe` baixa o áudio inteiro via URL
3. Envia para Whisper (OpenAI) → transcrição
4. Envia para Claude Haiku → análise

**Problema**: Download de áudio + Whisper é lento, caro, e redundante se o Zadarma já transcreveu.

## Proposta: Buscar transcrição direto da API Zadarma

O Zadarma expõe o endpoint `GET /v1/pbx/record/transcript/` que retorna o texto já transcrito por eles. O proxy já tem toda a infraestrutura de autenticação HMAC pronta.

### Alterações

**1. `supabase/functions/zadarma-proxy/index.ts`**
- Adicionar action `get_transcript` que chama `/v1/pbx/record/transcript/` com o `call_id`

**2. `supabase/functions/call-transcribe/index.ts`**
- **Passo 1**: Tentar buscar transcrição do Zadarma via proxy interno (custo zero, já pago no plano)
- **Passo 2**: Se não houver transcrição disponível (serviço não habilitado no ramal), fallback para Gemini Flash multimodal via Lovable AI Gateway (sem precisar de OPENAI_API_KEY)
- Manter a análise de sentimento/action_items via `callAI()` usando a transcrição obtida (de qualquer fonte)
- Remover dependência obrigatória de `OPENAI_API_KEY`

**3. `supabase/functions/zadarma-webhook/index.ts`**
- Sem alteração — já dispara `call-transcribe` no `NOTIFY_RECORD`

### Fluxo resultante
```text
NOTIFY_RECORD → call-transcribe
  ├─ Tenta: GET /v1/pbx/record/transcript/ (grátis, rápido)
  │   └─ Se tem texto → usa direto
  ├─ Fallback: Gemini Flash multimodal (áudio base64, sem Whisper)
  │   └─ Se GOOGLE_API_KEY → transcreve + analisa em 1 chamada
  └─ Análise: callAI() com texto → summary, sentiment, action_items
```

### Resultado
- Zero custo de transcrição quando Zadarma Speech Recognition está habilitado
- Fallback inteligente para Gemini quando não está
- Remove dependência de OPENAI_API_KEY
- Mesmo pipeline posterior (deal_activity, CS notifications, incidents)

