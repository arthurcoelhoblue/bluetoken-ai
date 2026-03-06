

## Diagnóstico real

Inspecionei todos os arquivos relevantes. O estado atual do código:

- `DealDetailSheet.tsx`: `modal={false}` ✓, `showOverlay={false}` ✓, handlers com detecção de `[data-fab-widget]` ✓
- `sheet.tsx`: suporta `showOverlay` condicional ✓  
- `ZadarmaPhoneWidget.tsx`: **todos os 4 portals já têm `data-fab-widget`** (linhas 457, 477, 546, 576) ✓

A causa raiz **não é** `data-fab-widget` faltando. O problema é que a detecção do target nos handlers `onPointerDownOutside` / `onInteractOutside` é **frágil**: dependendo da versão/comportamento do Radix, `e.detail?.originalEvent?.target` pode ser `undefined`, fazendo com que a condição `closest('[data-fab-widget]')` nunca seja verdadeira, e `preventDefault()` **nunca seja chamado**. Resultado: Radix chama `handleOpenChange(false)`, que dispara o `ScheduleActivityDialog` em vez de fechar o sheet.

## Solução definitiva

**Arquivo: `src/components/deals/DealDetailSheet.tsx`** — simplificar os handlers para **sempre** prevenir o fechamento por clique fora:

```tsx
<SheetContent
  className="w-[600px] sm:max-w-[600px] flex flex-col overflow-y-auto p-0"
  showOverlay={false}
  onPointerDownOutside={(e) => e.preventDefault()}
  onInteractOutside={(e) => e.preventDefault()}
>
```

### Por que isso funciona

Com `modal={false}` + `showOverlay={false}`, o sheet já não tem backdrop nem FocusTrap. O único efeito restante é que Radix ainda dispara `onPointerDownOutside` quando detecta clique fora do `SheetContent`, tentando fechar o dialog. Ao prevenir **incondicionalmente**, eliminamos toda fragilidade de detecção de target.

O sheet continua fechável via:
- Botão X (SheetPrimitive.Close)
- Botão explícito `onClose` no `DealDetailHeader`
- Lógica de `handleOpenChange` para ações programáticas

### Impacto

- Nenhum outro Sheet é afetado (a mudança é só no `DealDetailSheet`)
- O widget de telefonia recebe todos os cliques normalmente
- O `ScheduleActivityDialog` só aparece quando o usuário explicitamente fecha o sheet (via X ou botão close)

