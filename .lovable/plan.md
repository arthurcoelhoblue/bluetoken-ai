
# Fallback Gemini 3 Pro via API Direta

## Resumo

Substituir a chamada ao Lovable AI Gateway pelo acesso direto a API do Google Generative AI, usando o modelo `gemini-3-pro-preview` e o secret `GOOGLE_API_KEY` ja configurado.

## O que muda

Apenas o bloco de fallback (linhas 141-170) em `supabase/functions/next-best-action/index.ts`:

- Remove referencia ao `LOVABLE_API_KEY` e ao gateway `ai.gateway.lovable.dev`
- Usa `GOOGLE_API_KEY` com endpoint direto: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent`
- Adapta o payload para o formato nativo do Google (`contents` + `generationConfig`)
- Adapta o parsing da resposta de `choices[0].message.content` para `candidates[0].content.parts[0].text`

## Secao Tecnica

### Arquivo editado

`supabase/functions/next-best-action/index.ts` -- bloco de fallback (~30 linhas)

### Codigo do fallback atualizado

```typescript
// Fallback 1: Try Gemini Direct API
const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
if (GOOGLE_API_KEY) {
  console.log('[NBA] Trying Gemini 3 Pro direct fallback...');
  try {
    const prompt = `${systemPrompt}\n\nContexto do vendedor:\n${JSON.stringify(contextSummary, null, 2)}\n\nSugira as próximas ações prioritárias com narrativa do dia.`;
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
        }),
      }
    );
    if (geminiRes.ok) {
      const geminiData = await geminiRes.json();
      aiContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      console.log('[NBA] Gemini direct fallback succeeded');
    } else {
      console.error('[NBA] Gemini direct fallback error:', geminiRes.status);
    }
  } catch (geminiErr) {
    console.error('[NBA] Gemini direct fallback exception:', geminiErr);
  }
}
```

### Cascata de fallback (sem alteracao na estrutura)

1. Anthropic Claude (primario)
2. Google Gemini 3 Pro Preview via API direta (fallback AI)
3. Regras deterministicas (fallback final)

### Sem outras alteracoes

- Sem migracao SQL
- Sem alteracao de frontend
- Secret `GOOGLE_API_KEY` ja existe no projeto
