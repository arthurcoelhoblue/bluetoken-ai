
# Migracao: Gemini 3 Pro Primario + Claude Fallback (todas as funcoes)

## Resumo

Inverter a ordem de chamada em todas as edge functions que usam IA: Gemini 3 Pro Preview via Google API direta sera o motor primario, e Claude Sonnet sera o fallback caso o Gemini falhe. Isso reduz custos significativamente mantendo qualidade.

## Funcoes que serao alteradas (12 funcoes)

| # | Funcao | Chamadas Anthropic | Complexidade |
|---|--------|-------------------|--------------|
| 1 | copilot-chat | 1 | Media (system+messages) |
| 2 | deal-scoring | 1 | Baixa (prompt simples) |
| 3 | deal-loss-analysis | 2 (individual + portfolio) | Media |
| 4 | deal-context-summary | 1 | Media (system+user) |
| 5 | weekly-report | 1 (ja tem fallback Gemini) | Baixa |
| 6 | cs-daily-briefing | 1 | Baixa |
| 7 | call-coach | 1 | Media |
| 8 | call-transcribe | 1 (analise pos-whisper) | Baixa |
| 9 | ai-benchmark | 1 | Baixa |
| 10 | amelia-learn | 2 (sequencia perda + churn) | Media |
| 11 | cs-trending-topics | 1 | Baixa |
| 12 | amelia-mass-action | 1 | Baixa |

## Funcoes ja migradas ou sem IA (sem alteracao)

- **next-best-action** -- ja migrado
- **sdr-ia-interpret** -- ja usa tryGoogleDirect como primario
- **notify-closer, cs-churn-predictor, revenue-forecast, cs-incident-detector** -- nao usam IA

## Padrao de implementacao (igual em todas)

Cada chamada Anthropic sera substituida por este padrao:

```text
1. Tentar Gemini 3 Pro Preview (primario)
   - POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GOOGLE_API_KEY}
   - Body: { contents: [{ parts: [{ text: systemPrompt + userPrompt }] }], generationConfig: { temperature, maxOutputTokens } }
   - Parse: candidates[0].content.parts[0].text

2. Se falhar -> Tentar Anthropic Claude (fallback)
   - Manter chamada existente como esta hoje
   - Apenas envolvida em bloco de fallback

3. Se ambos falharem -> Fallback deterministico (quando existir)
```

## Secao Tecnica

### Adaptacao system prompt vs user prompt

O Google Generative AI nao tem campo `system` separado como Anthropic. Para funcoes que usam system prompt, concatenaremos:

```typescript
const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
// ou para copilot-chat com multiplas mensagens:
const fullPrompt = `${systemContent}\n\n${messages.map(m => `[${m.role}]: ${m.content}`).join('\n')}`;
```

### Copilot-chat (caso especial)

O copilot-chat envia multiplas mensagens (historico de conversa). Para Gemini, concatenaremos o historico em um unico prompt com marcadores de role, mantendo o system prompt no inicio.

### Funcoes com 2 chamadas (deal-loss-analysis, amelia-learn)

Cada chamada individual dentro da funcao recebera seu proprio bloco try Gemini / catch fallback Claude.

### Secret necessario

`GOOGLE_API_KEY` -- ja configurado no projeto.

### Config.toml

Sem alteracoes necessarias -- todas as funcoes ja estao registradas.

### Nenhuma alteracao de frontend

O frontend chama as edge functions da mesma forma. Apenas o motor de IA interno muda.

### Ordem de implementacao

Todas as 12 funcoes serao editadas em paralelo na mesma sessao, ja que sao independentes.

### Riscos e mitigacao

- **Risco**: Gemini pode retornar JSON malformado em casos raros
- **Mitigacao**: O fallback para Claude captura esse cenario automaticamente
- **Risco**: Rate limit do Google API
- **Mitigacao**: Claude como fallback garante continuidade
