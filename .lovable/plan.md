

# Fix: Comma left dangling after robotic word removal

## Root Cause

In `response-generator.ts` line 46, the regex pattern that strips standalone robotic openers has a character class `[!.]?` that does NOT include commas:

```
/^(Perfeito|Entendi|...)[!.]?\s*/i
```

When the AI generates "Certo, Arthur. Como voce faz trade...", line 46 matches only "Certo" (the comma is not in `[!.]`), leaving ", Arthur. Como...". Line 47 can no longer match because the text now starts with a comma instead of a word.

## Fix

Change line 46's character class from `[!.]?` to `[,;!.]?` so it also consumes trailing commas (and semicolons for safety):

```typescript
// Line 46 — BEFORE:
/^(Perfeito|Entendi|Entendido|Excelente|Ótimo|Ótima|Legal|Maravilha|Show|Certo|Claro|Com certeza|Que bom|Beleza|Fantástico|Incrível|Sensacional|Bacana|Perfeita|Entendida)[!.]?\s*/i

// Line 46 — AFTER:
/^(Perfeito|Entendi|Entendido|Excelente|Ótimo|Ótima|Legal|Maravilha|Show|Certo|Claro|Com certeza|Que bom|Beleza|Fantástico|Incrível|Sensacional|Bacana|Perfeita|Entendida)[,;!.]?\s*/i
```

This single character change ensures that when "Certo," is at the start, both the word AND the comma are removed, so the remaining text starts cleanly.

## File changed

| File | Change |
|------|--------|
| `supabase/functions/sdr-ia-interpret/response-generator.ts` | Add `,;` to character class on line 46 |

## Technical detail

The patterns are applied sequentially (line 56: `for (const p of patterns) { cleaned = cleaned.replace(p, ''); }`). Line 46 runs before line 47. When line 46 removes only "Certo" (without the comma), line 47 sees ", Arthur..." which doesn't match its `^(word)` anchor. Adding the comma to line 46's class ensures the entire "Certo, " prefix is consumed in one pass.

