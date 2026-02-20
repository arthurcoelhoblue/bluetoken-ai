
# Migração para gemini-3-flash-preview via Google API própria

## Ajustes em relação ao plano anterior

Com base nas suas definições:

- `copilot-chat` sai do Grupo A e entra no Grupo B (migra para Gemini Flash)
- Nenhuma função usa a Lovable AI Gateway — a própria API do Google (GOOGLE_API_KEY) já está configurada no projeto
- Grupo A (mantém Claude): apenas `sdr-response-generator`, `sdr-proactive-outreach` e `amelia-mass-action`
- Grupo B (migra para Gemini Flash): 17 funções — incluindo `copilot-chat`

## Como funciona a sua API própria

O projeto já usa a Google AI API diretamente em `_shared/ai-provider.ts`, chamando `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent` com a `GOOGLE_API_KEY`. A mudança é simplesmente trocar o modelo de `gemini-3-pro-preview` para `gemini-3-flash-preview` **somente quando a função pedir**.

Não é necessário nenhum segredo novo — a `GOOGLE_API_KEY` já existe no projeto.

## Estratégia de implementação

### Arquivo central: `_shared/ai-provider.ts`

Adicionar parâmetro opcional `model?: 'gemini-flash'` na interface `CallAIOptions`. Quando esse parâmetro estiver presente, a cadeia de chamada muda:

**Sem `model: 'gemini-flash'`** (comportamento atual — Claude → Gemini Pro → GPT-4o):
```
Claude Sonnet 4.6 → Gemini Pro → GPT-4o
```

**Com `model: 'gemini-flash'`** (novo comportamento para Grupo B):
```
Gemini Flash (google propria) → Claude → Gemini Pro → GPT-4o
```

O Gemini Flash entra como **primeira tentativa**. Se falhar por qualquer motivo, cai normalmente para Claude → Gemini Pro → GPT-4o (fallback de segurança preservado).

### Custo na COST_TABLE

Adicionar entrada para o novo modelo:
```typescript
'gemini-3-flash-preview': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
```

Isso garante que a telemetria na página `/admin/ai-costs` registre corretamente o custo do Gemini Flash separado do Gemini Pro.

---

## Arquivos alterados

### 1. `supabase/functions/_shared/ai-provider.ts`

- Adicionar `model?: 'gemini-flash'` em `CallAIOptions`
- Adicionar `'gemini-3-flash-preview'` no `COST_TABLE`
- Inserir bloco **antes do Claude**: se `model === 'gemini-flash'` E `GOOGLE_API_KEY` existe, chama `gemini-3-flash-preview:generateContent`. Se retornar conteúdo, usa esse resultado e **pula** Claude/Gemini Pro/GPT-4o (exceto se falhar — aí cai para a cadeia normal)

### 2. `src/lib/sdr-logic.ts`

- Adicionar `'gemini-3-flash-preview'` no `COST_TABLE` exportado para que os testes de custo cubram o novo modelo

### 3. Funções do Grupo B — adicionar `model: 'gemini-flash'` na chamada `callAI()`

17 funções recebem a flag. Apenas o argumento `model: 'gemini-flash'` é adicionado, sem mais nenhuma alteração de lógica:

| Função | Arquivo |
|---|---|
| `copilot-chat` | `supabase/functions/copilot-chat/index.ts` |
| `copilot-proactive` | `supabase/functions/copilot-proactive/index.ts` |
| `sdr-intent-classifier` | `supabase/functions/sdr-ia-interpret/intent-classifier.ts` |
| `deal-scoring` | `supabase/functions/deal-scoring/index.ts` |
| `deal-loss-analysis` | `supabase/functions/deal-loss-analysis/index.ts` |
| `deal-context-summary` | `supabase/functions/deal-context-summary/index.ts` |
| `cs-health-calculator` | `supabase/functions/cs-health-calculator/index.ts` |
| `cs-scheduled-jobs` | `supabase/functions/cs-scheduled-jobs/index.ts` |
| `cs-ai-actions` | `supabase/functions/cs-ai-actions/index.ts` |
| `call-transcribe` | `supabase/functions/call-transcribe/index.ts` |
| `call-coach` | `supabase/functions/call-coach/index.ts` |
| `weekly-report` | `supabase/functions/weekly-report/index.ts` |
| `icp-learner` | `supabase/functions/icp-learner/index.ts` |
| `next-best-action` | `supabase/functions/next-best-action/index.ts` |
| `revenue-forecast` | `supabase/functions/revenue-forecast/index.ts` |
| `faq-auto-review` | `supabase/functions/faq-auto-review/index.ts` |
| `amelia-learn` | `supabase/functions/amelia-learn/index.ts` |

---

## Funções que NÃO recebem a flag (mantêm Claude como primário)

| Função | Motivo |
|---|---|
| `sdr-ia-interpret/response-generator.ts` | Gera resposta enviada ao lead — qualidade máxima |
| `sdr-proactive-outreach` | Mensagem de abordagem enviada ao lead — primeira impressão |
| `amelia-mass-action` | Campanhas enviadas diretamente para leads |

---

## Impacto de custo estimado

| Modelo | Input | Output |
|---|---|---|
| Claude Sonnet 4.6 | $3.00/M | $15.00/M |
| Gemini Pro Preview | $1.25/M | $10.00/M |
| Gemini Flash Preview | **$0.075/M** | **$0.30/M** |

Redução estimada de **94% no custo** das 17 funções migradas vs. Claude, e **~94% vs.** Gemini Pro.

---

## Zero risco para as conversas com leads

As 3 funções do Grupo A não são alteradas. O fallback automático garante que, mesmo que o Gemini Flash falhe, o sistema usa Claude → Gemini Pro → GPT-4o automaticamente. Nenhuma função fica sem resposta.

A telemetria em `ai_usage_log` registrará `model: 'gemini-3-flash-preview'` e `provider: 'gemini'`, visível na página de Custos IA que você está vendo agora.
