

## Fix: `handleOpenChange` abre dialog de agendamento ao clicar no widget

### Problema
Com `modal={false}`, o Radix Sheet ainda dispara `onOpenChange(false)` quando detecta cliques fora do `SheetContent`. Isso aciona o `handleOpenChange`, que verifica se o deal tem atividade futura e, se não tem, abre o `ScheduleActivityDialog` — mesmo quando o clique foi no widget de telefonia.

### Correção
Em `src/components/deals/DealDetailSheet.tsx`, restaurar os handlers `onPointerDownOutside` e `onInteractOutside` no `SheetContent` para prevenir que cliques em `[data-fab-widget]` disparem o `onOpenChange`:

```tsx
<SheetContent
  className="w-[600px] sm:max-w-[600px] flex flex-col overflow-y-auto p-0"
  onPointerDownOutside={(e) => {
    const target = (e.detail?.originalEvent?.target ?? e.target) as HTMLElement | null;
    if (target?.closest?.('[data-fab-widget]')) {
      e.preventDefault();
    }
  }}
  onInteractOutside={(e) => {
    const target = ((e as any).detail?.originalEvent?.target ?? (e as any).target) as HTMLElement | null;
    if (target?.closest?.('[data-fab-widget]')) {
      e.preventDefault();
    }
  }}
>
```

Com `modal={false}`, não há FocusTrap nem overlay bloqueante — então esses handlers agora funcionarão corretamente para impedir que o `onOpenChange` seja chamado ao clicar nos FABs, sem bloquear os cliques nos próprios widgets.

### Arquivo afetado
- `src/components/deals/DealDetailSheet.tsx` — adicionar handlers ao `SheetContent`

