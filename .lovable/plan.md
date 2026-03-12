

## Plano: Corrigir drag & drop no Kanban

### Causa raiz

Conflito entre `useGrabScroll` e o dnd-kit. O `useGrabScroll` registra `pointerdown` no scroll container em **capture phase** (linha 137), o que pode interferir com o tracking de ponteiro do dnd-kit. Além disso, o `onClick` do `DealCard` dispara após o drop, abrindo o detalhe do deal e potencialmente interrompendo o processamento do drop.

### Correções

**1. `src/hooks/useGrabScroll.ts`** — Desabilitar grab scroll durante drag ativo

- Exportar um ref/flag `isDragging` que o KanbanBoard pode setar
- Alternativa mais limpa: aceitar um parâmetro `disabled` no hook e retornar early em todos os handlers quando `disabled === true`

**2. `src/components/pipeline/KanbanBoard.tsx`** — Passar flag de drag ativo

- Usar o estado `activeDeal` que já existe para desabilitar o grab scroll durante drag
- Passar `disabled={!!activeDeal}` para o hook `useGrabScroll`

**3. `src/components/pipeline/DealCard.tsx`** — Prevenir click após drag

- Adicionar um ref `wasDragged` que é setado em `true` quando `isDragging` muda para `true`
- No `onClick`, verificar `wasDragged` e ignorar o click se houve drag

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/hooks/useGrabScroll.ts` | Adicionar parâmetro `disabled` para desativar durante drag |
| `src/components/pipeline/KanbanBoard.tsx` | Passar `disabled` baseado em `activeDeal` |
| `src/components/pipeline/DealCard.tsx` | Suprimir `onClick` após drag com ref |

