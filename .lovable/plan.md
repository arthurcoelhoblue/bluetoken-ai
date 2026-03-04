

## Problema

O `useTemplates.ts` usa `toast()` importado de `@/hooks/use-toast` (sistema shadcn), mas o `App.tsx` só renderiza o `<Sonner>` (da biblioteca sonner). O componente `<Toaster>` do shadcn **não está montado**, então todos os toasts de sucesso/erro das mutations de templates são despachados mas nunca exibidos na tela.

Os edge functions estão funcionando corretamente (logs confirmam sync completed e template creation), mas o usuário não recebe nenhum feedback visual.

## Correção

Alterar `src/hooks/useTemplates.ts` para usar `toast` da biblioteca **sonner** (que é o sistema de toasts ativo no app) em vez de `@/hooks/use-toast`.

Mudança no import:
- **De:** `import { toast } from '@/hooks/use-toast';`
- **Para:** `import { toast } from 'sonner';`

Adaptar todas as chamadas de toast no arquivo para a API do sonner:
- `toast({ title: 'X', description: 'Y' })` → `toast.success('X', { description: 'Y' })`
- `toast({ title: 'X', description: 'Y', variant: 'destructive' })` → `toast.error('X', { description: 'Y' })`

Isso afeta as 8 chamadas de toast no arquivo (create, update, delete, sync, submit success/error).

