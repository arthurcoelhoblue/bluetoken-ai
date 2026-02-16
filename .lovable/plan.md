
# Corrigir 4 violacoes de ESLint (`as any`)

Varredura feita. Os 4 casos mais criticos e limpos de corrigir sao usos de `as any` que podem ser eliminados com tipagem correta.

## Correcoes

### 1. `src/components/zadarma/DealCallsPanel.tsx`
**Problema**: `call as any` para acessar `summary_ia`, `transcription`, `action_items` que nao existem no tipo `Call`.
**Solucao**: Adicionar os 3 campos opcionais ao `interface Call` em `src/types/telephony.ts`:
- `summary_ia?: string | null`
- `transcription?: string | null`
- `action_items?: string[] | null`

Depois remover `const callAny = call as any` e usar `call.summary_ia`, `call.transcription`, `call.action_items` diretamente.

### 2. `src/pages/cs/CSPesquisasPage.tsx`
**Problema**: `(s.customer as any)?.contact?.nome` quando o tipo `CSSurvey` ja define `customer?: { id: string; contact?: { nome: string } }`.
**Solucao**: Remover o `as any` e usar `s.customer?.contact?.nome` diretamente (o tipo ja suporta).

### 3. `src/pages/PipelineConfigPage.tsx`
**Problema**: `{ nome, empresa, tipo } as any` porque `PipelineFormData` nao tem campo `tipo`.
**Solucao**: Adicionar `tipo?: string` ao `PipelineFormData` em `src/types/customFields.ts` e remover o `as any`.

### 4. `src/hooks/useCopilotInsights.ts`
**Problema**: `(error as any)?.status` para verificar status HTTP do erro.
**Solucao**: Criar um type guard inline: `const errObj = error as { status?: number; context?: { status?: number } }` — tipagem explicita sem `any`.

---

## Detalhes tecnicos

**Arquivos modificados** (5 arquivos):
- `src/types/telephony.ts` — 3 campos novos em `Call`
- `src/types/customFields.ts` — 1 campo novo em `PipelineFormData`
- `src/components/zadarma/DealCallsPanel.tsx` — remover `as any`
- `src/pages/cs/CSPesquisasPage.tsx` — remover `as any`
- `src/pages/PipelineConfigPage.tsx` — remover `as any`
- `src/hooks/useCopilotInsights.ts` — substituir `as any` por tipo explicito

**Impacto**: Zero regressao funcional. Apenas tipagem mais segura.
