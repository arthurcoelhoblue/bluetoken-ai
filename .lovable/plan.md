

# Adicionar OpenAI API Direta como Terceira Camada de Fallback

## Resumo

Adicionar uma chamada direta a API da OpenAI como terceiro fallback em todas as 13 edge functions que usam IA. Usando o secret `OPENAI_API_KEY` ja configurado no projeto.

## Hierarquia final (4 camadas)

```text
1. Gemini 3 Pro Preview (primario)
      |  falhou?
2. Claude Sonnet (fallback 1)
      |  falhou?
3. OpenAI GPT-4o via API direta (fallback 2)
      |  falhou?
4. Regras deterministicas (fallback final, onde existir)
```

## Modelo escolhido: gpt-4o

O modelo `gpt-5.2` existe apenas no Lovable AI Gateway. Na API direta da OpenAI, o equivalente de alto desempenho disponivel e o `gpt-4o` -- multimodal, rapido, e com excelente capacidade de seguir instrucoes JSON.

## Funcoes alteradas (13)

next-best-action, copilot-chat, deal-scoring, deal-loss-analysis, deal-context-summary, weekly-report, cs-daily-briefing, call-coach, call-transcribe, ai-benchmark, amelia-learn, cs-trending-topics, amelia-mass-action

## Secao Tecnica

### Bloco OpenAI padrao (inserido apos Claude, antes do fallback deterministico)

```typescript
// Fallback 2: OpenAI GPT-4o via API direta
if (!content) {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (OPENAI_API_KEY) {
    console.log('[FUNCAO] Trying OpenAI GPT-4o fallback...');
    try {
      const gptResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      });
      if (gptResp.ok) {
        const gptData = await gptResp.json();
        content = gptData.choices?.[0]?.message?.content ?? '';
        console.log('[FUNCAO] OpenAI GPT-4o fallback succeeded');
      } else {
        console.error('[FUNCAO] OpenAI error:', gptResp.status);
      }
    } catch (gptErr) {
      console.error('[FUNCAO] OpenAI exception:', gptErr);
    }
  }
}
```

### Adaptacoes por funcao

- **Funcoes simples** (10 funcoes): Bloco padrao com system + user prompt
- **copilot-chat**: Usa array de mensagens nativo do formato OpenAI (system + historico completo)
- **deal-loss-analysis / amelia-learn**: Cada chamada AI interna recebe seu proprio bloco OpenAI
- **next-best-action**: Estrutura diferente (Anthropic primario, Gemini fallback 1) -- OpenAI sera fallback 2 antes das regras deterministicas

### Vantagem do formato OpenAI

O formato `messages` com roles e nativo da API -- nao precisa concatenar system + user em texto unico como no Gemini.

### Secret

`OPENAI_API_KEY` -- ja configurado no projeto. Nenhuma acao necessaria.

### Sem outras alteracoes

- Sem migracoes SQL
- Sem alteracoes de frontend
- Sem novos secrets
- Todas as 13 funcoes editadas em paralelo

