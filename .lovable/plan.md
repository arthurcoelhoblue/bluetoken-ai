

## Diagnóstico

O último edit **removeu** os handlers `onPointerDownOutside` e `onInteractOutside` do `SheetContent`. Segundo a memória do projeto, a versão funcional **tinha** esses handlers — eles interceptavam cliques fora do sheet e verificavam se o alvo era um widget FAB (`data-fab-widget`). Sem eles, o comportamento de clique fora quebrou.

## Correção

**Arquivo: `src/components/deals/DealDetailSheet.tsx`** — restaurar os handlers no `SheetContent`:

```tsx
<SheetContent
  className="w-[600px] sm:max-w-[600px] flex flex-col overflow-y-auto p-0"
  onPointerDownOutside={(e) => {
    const target = e.detail?.originalEvent?.target as HTMLElement | null;
    if (target?.closest('[data-fab-widget]')) {
      e.preventDefault();
    }
  }}
  onInteractOutside={(e) => {
    const target = e.detail?.originalEvent?.target as HTMLElement | null;
    if (target?.closest('[data-fab-widget]')) {
      e.preventDefault();
    }
  }}
>
```

Esses handlers fazem exatamente o que funcionava antes: permitem cliques nos FABs (telefone/copilot) sem fechar o sheet, e permitem que cliques em outras áreas fechem normalmente.

### Arquivo afetado
- `src/components/deals/DealDetailSheet.tsx` — restaurar `onPointerDownOutside` e `onInteractOutside`

