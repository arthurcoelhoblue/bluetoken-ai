
# Corrigir 4 erros de ESLint

## Correções

### 1. `PublicFormRenderer.tsx:125` — `no-case-declarations`
Envolver o bloco do `case 'multi_select'` com chaves `{}` para criar escopo lexico para a declaracao `const selected`.

### 2. `KanbanBoard.tsx:52` — `no-empty` (catch vazio)
Adicionar comentario `// ignore` no catch vazio do `localStorage.setItem`.

### 3. `command.tsx:24` — `no-empty-object-type`
Substituir `interface CommandDialogProps extends DialogProps {}` por `type CommandDialogProps = DialogProps`.

### 4. `textarea.tsx:5` — `no-empty-object-type`
Substituir `export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}` por `export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>`.

---

## Detalhes tecnicos

| Arquivo | Linha | Erro | Correcao |
|---------|-------|------|----------|
| `src/components/capture-forms/PublicFormRenderer.tsx` | 124-125 | `no-case-declarations` | Adicionar `{` apos `case 'multi_select':` e `}` no final do bloco antes do proximo case/default |
| `src/components/pipeline/KanbanBoard.tsx` | 52 | `no-empty` | `catch {}` vira `catch { /* ignore */ }` |
| `src/components/ui/command.tsx` | 24 | `no-empty-object-type` | `interface CommandDialogProps extends DialogProps {}` vira `type CommandDialogProps = DialogProps` |
| `src/components/ui/textarea.tsx` | 5 | `no-empty-object-type` | `export interface TextareaProps ...{}` vira `export type TextareaProps = ...` |

Todas sao correcoes de uma linha, sem impacto funcional.
