

## Plano: Migrar `sdr-intent-classifier` para Claude Haiku 4.5

### Alteração única

**Arquivo:** `supabase/functions/sdr-ia-interpret/intent-classifier.ts` (linha 548-558)

Adicionar `model: 'claude-haiku'` na chamada `callAI()`:

```typescript
const aiResult = await callAI({
  system: activeSystemPrompt,
  prompt: userPrompt,
  functionName: 'sdr-intent-classifier',
  empresa,
  temperature: 0.3,
  maxTokens: 1500,
  promptVersionId: selectedPromptVersionId || undefined,
  supabase,
  model: 'claude-haiku',  // Haiku 4.5 — menor custo, suficiente para classificação
});
```

### Impacto
- **Custo**: Input cai de $3.00/M tokens (Sonnet) → $0.80/M tokens (Haiku) = **~73% redução**
- **Output**: cai de $15.00/M → $4.00/M = **~73% redução**
- **Fallback**: Se Haiku falhar, cai automaticamente para Sonnet → Gemini → GPT-4o (já implementado no `ai-provider.ts`)
- **Deploy**: Edge function `sdr-ia-interpret` será redeployada automaticamente

