

# Atualizar modelo primario para Claude Sonnet 4.6

## Resumo

Trocar o modelo primario de IA de `claude-sonnet-4-20250514` (Sonnet 4) para `claude-sonnet-4-6` (Sonnet 4.6) em todos os arquivos relevantes. O Sonnet 4.6 foi lancado em 17/02/2026 e oferece performance superior ao Sonnet 4 com o mesmo pricing ($3/M input, $15/M output).

## Arquivos a alterar

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/_shared/ai-provider.ts` | Model ID na chamada Anthropic + COST_TABLE |
| `src/lib/sdr-logic.ts` | COST_TABLE key |
| `src/types/settings.ts` | AI_PROVIDERS models array |
| `src/components/settings/AISettingsTab.tsx` | Modelo default ANTHROPIC |
| `src/lib/__tests__/ai-provider-logic.test.ts` | Model IDs nos testes |

## Detalhes tecnicos

### 1. `supabase/functions/_shared/ai-provider.ts`

- Linha 29: `'claude-sonnet-4-20250514'` -> `'claude-sonnet-4-6'` (COST_TABLE)
- Linha 133: `model: 'claude-sonnet-4-20250514'` -> `model: 'claude-sonnet-4-6'` (chamada API)
- Linha 138: `model = 'claude-sonnet-4-20250514'` -> `model = 'claude-sonnet-4-6'` (telemetria)

### 2. `src/lib/sdr-logic.ts`

- Linha 186: `'claude-sonnet-4-20250514'` -> `'claude-sonnet-4-6'` (COST_TABLE)

### 3. `src/types/settings.ts`

- Linha 151: Adicionar `'claude-sonnet-4-6'` e manter `'claude-sonnet-4-20250514'` como opcao legada

### 4. `src/components/settings/AISettingsTab.tsx`

- Linha 23: `"claude-sonnet-4-20250514"` -> `"claude-sonnet-4-6"`

### 5. `src/lib/__tests__/ai-provider-logic.test.ts`

- Atualizar todas as referencias de `'claude-sonnet-4-20250514'` para `'claude-sonnet-4-6'` nos testes de custo

### Pricing (sem alteracao de valores)

O Sonnet 4.6 mantem o mesmo pricing do Sonnet 4: $3/M tokens input, $15/M tokens output. Portanto a COST_TABLE so muda a key, nao os valores.

