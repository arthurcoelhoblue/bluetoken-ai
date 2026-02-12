

# Mudanca de Prioridade: Gemini 3 Pro Preview como Modelo Principal

## Contexto Atual

- Ordem atual: ANTHROPIC (1o) -> GEMINI (2o) -> GPT (3o)
- Modelo Gemini atual: `google/gemini-2.5-flash`
- Gemini e GPT passam pelo Lovable AI Gateway (LOVABLE_API_KEY)
- Anthropic vai direto na API com ANTHROPIC_API_KEY

## O que sera feito

### 1. Adicionar modelo `google/gemini-3-pro-preview` a lista de modelos disponiveis

**Arquivo:** `src/types/settings.ts`

Adicionar `google/gemini-3-pro-preview` na lista de modelos do provider GEMINI.

### 2. Atualizar a ordem de prioridade no banco

Executar SQL para alterar `system_settings.ia.model_priority`:
- Ordem: `["GEMINI", "ANTHROPIC", "GPT"]`
- Modelo GEMINI: `google/gemini-3-pro-preview`

### 3. Adicionar suporte a Google API Key direta (opcional)

Atualmente o Gemini passa pelo Lovable AI Gateway. Para usar a API do Google diretamente (como e feito com Anthropic), sera necessario:

- Solicitar ao usuario o secret `GOOGLE_API_KEY`
- Criar funcao `tryGoogleDirect()` no `sdr-ia-interpret/index.ts` que chama `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- No switch de providers, quando `GEMINI` e o modelo comeca com `google/gemini-3`, usar a API direta; senao, manter o Lovable AI Gateway como fallback

### 4. Campo de API Key na UI

**Arquivo:** `src/components/settings/AISettingsTab.tsx`

Nao sera necessario criar um campo customizado na UI. O sistema ja gerencia secrets de forma segura. A chave sera solicitada via ferramenta de secrets do Lovable Cloud.

## Detalhes Tecnicos

### Mudanca em `src/types/settings.ts` (linha 142)

Adicionar o novo modelo na lista GEMINI:
```text
{ id: 'GEMINI', name: 'Google (Gemini)', models: ['google/gemini-3-pro-preview', 'google/gemini-2.5-flash', 'google/gemini-2.5-flash-lite', 'google/gemini-2.5-pro'] }
```

### Mudanca em `supabase/functions/sdr-ia-interpret/index.ts`

Adicionar funcao `tryGoogleDirect()` similar a `tryAnthropic()` mas usando a API do Google Generative AI. No loop de providers, se `GEMINI` e ha `GOOGLE_API_KEY` configurada, usar chamada direta; senao, cair no Lovable AI Gateway.

### SQL de atualizacao

```text
UPDATE system_settings 
SET value = '{"ordem":["GEMINI","ANTHROPIC","GPT"],"modelos":{"ANTHROPIC":"claude-sonnet-4-20250514","GEMINI":"google/gemini-3-pro-preview","GPT":"openai/gpt-5-mini"},"desabilitados":[]}'::jsonb
WHERE category = 'ia' AND key = 'model_priority';
```

## Sequencia de Execucao

1. Solicitar `GOOGLE_API_KEY` ao usuario
2. Atualizar `AI_PROVIDERS` em `src/types/settings.ts`
3. Implementar `tryGoogleDirect()` no edge function
4. Atualizar prioridade no banco via SQL
5. Deploy da edge function

