

## Problema: Sheet do Deal bloqueia interação com FABs flutuantes

### Causa raiz

Mesmo com os FABs (telefone e copilot) renderizados via `createPortal` com `z-[9999]`, o problema persiste por **duas razões combinadas**:

1. **Overlay do Sheet captura pointer events**: O `SheetOverlay` tem `fixed inset-0 z-50 bg-black/80` e captura todos os cliques. Visualmente os FABs estão acima (z-[9999] > z-50), e os cliques chegam nos FABs. Porém...

2. **Radix `onPointerDownOutside` fecha o Sheet**: O Radix Dialog (base do Sheet) detecta qualquer clique fora do `SheetContent` e dispara o fechamento. Clicar no widget telefônico é "fora" do conteúdo do Sheet, então o Sheet fecha — mesmo que o clique tenha sido no FAB.

Resultado: ao clicar no botão "Ligar" do widget, o Sheet fecha antes que a ação de ligar seja processada. Ao arrastar o widget para a esquerda, o pointer up fora do Sheet também dispara o fechamento.

### Correção

**1. `src/components/deals/DealDetailSheet.tsx`** — Adicionar `onPointerDownOutside` ao `SheetContent` para ignorar cliques nos FABs:
- Verificar se o `event.target` está dentro de um elemento com `z-[9999]` (os FABs) usando `closest('[data-fab-widget]')`
- Se sim, chamar `event.preventDefault()` para impedir o Radix de fechar o Sheet

**2. `src/components/zadarma/ZadarmaPhoneWidget.tsx`** — Adicionar `data-fab-widget` no container do portal para identificação

**3. `src/components/copilot/CopilotFab.tsx`** — Mesmo `data-fab-widget` no container

### Alternativa complementar (overlay)

Modificar o `SheetOverlay` em `sheet.tsx` para usar `pointer-events-none` e adicionar um handler de clique separado para fechar — porém isso é mais invasivo e pode afetar outros Sheets. A abordagem com `onPointerDownOutside` é cirúrgica e segura.

### Arquivos afetados
1. `src/components/deals/DealDetailSheet.tsx` — `onPointerDownOutside` handler
2. `src/components/zadarma/ZadarmaPhoneWidget.tsx` — `data-fab-widget` attribute
3. `src/components/copilot/CopilotFab.tsx` — `data-fab-widget` attribute

