

## Diagnóstico

O arquivo `DealDetailSheet.tsx` **já tem** `modal={false}` (linha 144) e os handlers `onPointerDownOutside`/`onInteractOutside` (linhas 147-158). Portanto a correção anterior foi aplicada parcialmente.

**A causa raiz real** está em `src/components/ui/sheet.tsx`: o `SheetContent` **sempre renderiza** o `<SheetOverlay />` (linha 57), independente do modo modal. Esse overlay é um `<div>` fixo cobrindo toda a tela com `bg-black/80` que intercepta eventos de pointer — mesmo com `modal={false}`, o overlay continua bloqueando cliques no widget.

## Plano de correção

### 1. `src/components/ui/sheet.tsx` — Tornar o overlay condicional

Modificar `SheetContent` para aceitar uma prop `showOverlay` (default `true`) e só renderizar `<SheetOverlay />` quando `showOverlay` for `true`:

```tsx
interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  showOverlay?: boolean;
}

const SheetContent = React.forwardRef<...>(
  ({ side = "right", className, children, showOverlay = true, ...props }, ref) => (
    <SheetPortal>
      {showOverlay && <SheetOverlay />}
      <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        <SheetPrimitive.Close ...>
          ...
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  ),
);
```

### 2. `src/components/deals/DealDetailSheet.tsx` — Usar a nova prop e limpar handlers

- Adicionar `showOverlay={false}` ao `<SheetContent>`
- Remover os handlers `onPointerDownOutside` e `onInteractOutside` (não são mais necessários sem overlay)

```tsx
<Sheet open={open} onOpenChange={handleOpenChange} modal={false}>
  <SheetContent
    className="w-[600px] sm:max-w-[600px] flex flex-col overflow-y-auto p-0"
    showOverlay={false}
  >
```

### Resultado

Com `modal={false}` + sem overlay: sem backdrop bloqueante, sem FocusTrap, sem interceptação de eventos. O widget de telefonia receberá cliques normalmente. O fechamento do sheet continua controlado pelo botão X e pelo `handleOpenChange`.

