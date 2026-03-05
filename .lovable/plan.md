

## Fix: Desativar modo modal do Sheet para permitir interação com FABs

### Problema
O Radix Sheet em modo `modal` (padrão) ativa FocusTrap e overlay com `pointer-events: auto`, que capturam todos os cliques antes de atingirem o widget de telefonia — mesmo com `z-index: 9999` e `createPortal`.

### Correção
Uma única mudança em `src/components/deals/DealDetailSheet.tsx`:

1. Adicionar `modal={false}` ao componente `<Sheet>` (linha 144)
2. Remover os handlers `onPointerDownOutside` e `onInteractOutside` do `SheetContent` (já não serão necessários sem o modo modal)

O fechamento do Sheet já é controlado manualmente via `handleOpenChange` e botão explícito de fechar, então `modal={false}` não quebra nenhum comportamento existente.

### Arquivo afetado
- `src/components/deals/DealDetailSheet.tsx`

