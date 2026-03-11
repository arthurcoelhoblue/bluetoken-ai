
# Corrigir scrollbar nas notificações do sininho

## Problema
O `ScrollArea` do Radix usa `max-h-[420px] overflow-y-auto` no Root, mas o Radix gerencia o overflow internamente via seu Viewport. O `overflow-y-auto` no Root conflita com o mecanismo do Radix, impedindo a scrollbar de aparecer.

## Correção
Na linha 99 de `NotificationBell.tsx`, trocar:
```
<ScrollArea className="max-h-[420px] overflow-y-auto">
```
por:
```
<ScrollArea className="h-[420px]">
```

Usar `h-[420px]` (altura fixa) em vez de `max-h` permite que o Radix ScrollArea calcule corretamente o overflow e exiba a scrollbar personalizada. O conteúdo que exceder 420px será rolável com a barra visível.

| Arquivo | Mudança |
|:--|:--|
| `src/components/layout/NotificationBell.tsx` | Trocar `max-h-[420px] overflow-y-auto` por `h-[420px]` no ScrollArea |
