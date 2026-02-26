

## Substituir Gemini Flash por Claude Haiku 4.5

### Escopo

Todas as funcoes que hoje usam `model: 'gemini-flash'` (tarefas analiticas/internas) passarao a usar Claude Haiku 4.5 via API Anthropic.

### Arquivos afetados

**Core (1 arquivo):**

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/_shared/ai-provider.ts` | Renomear opcao `'gemini-flash'` → `'claude-haiku'`; substituir bloco 0 (Gemini Flash via Google API) por chamada Claude Haiku 4.5 via Anthropic API; adicionar `'claude-haiku-4-5'` ao COST_TABLE |

**Edge functions (12 arquivos) — trocar `model: 'gemini-flash'` por `model: 'claude-haiku'`:**

1. `cs-health-calculator/index.ts`
2. `deal-loss-analysis/index.ts` (2 chamadas)
3. `copilot-chat/index.ts`
4. `revenue-forecast/index.ts`
5. `amelia-learn/index.ts` (2 chamadas)
6. `call-transcribe/index.ts`
7. `call-coach/index.ts`
8. `deal-context-summary/index.ts`
9. `deal-scoring/index.ts`
10. `weekly-report/index.ts`
11. `faq-auto-review/index.ts`
12. `icp-learner/index.ts`

**Teste:**

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/__tests__/ai-provider-logic.test.ts` | Atualizar teste "Gemini cost is lower than Claude" para comparar claude-haiku-4-5 vs claude-sonnet-4-6 |

### Detalhe tecnico — ai-provider.ts

- `model` type muda de `'gemini-flash'` para `'claude-haiku'`
- Bloco 0 passa a chamar `https://api.anthropic.com/v1/messages` com `model: 'claude-haiku-4-5'` usando `ANTHROPIC_API_KEY` (ja configurada)
- COST_TABLE recebe entrada `'claude-haiku-4-5': { input: 0.80/1M, output: 4.0/1M }`
- Cadeia de fallback continua: Claude Haiku → Claude Sonnet → Gemini Pro → GPT-4o

### Nenhuma migration SQL necessaria

