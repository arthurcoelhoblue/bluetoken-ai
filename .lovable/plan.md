

# Correção: Widget de telefonia "fantasma"

## Causa raiz
O `CopilotFab` (linha 82-83 do CopilotFab.tsx) tem posição padrão `{ x: window.innerWidth - 48 - 24, y: window.innerHeight - 48 - 24 }` — exatamente o mesmo canto inferior direito onde o `ZadarmaPhoneWidget` renderiza com `bottom-6 right-6`. O CopilotFab captura pointer events para drag, interceptando todos os cliques destinados ao widget de telefonia.

## Correção

### 1. `src/components/zadarma/ZadarmaPhoneWidget.tsx`
Mover o FAB do telefone para `bottom-20` (80px do fundo) em vez de `bottom-6`, para ficar **acima** do CopilotFab. Aplicar em 3 posições:
- Linha 108: FAB minimizado → `bottom-20 right-6`
- Linha 120: FAB com dial pendente → `bottom-20 right-6`
- Linha 194: Widget expandido → `bottom-20 right-6`

### 2. Garantir z-index consistente
O CopilotFab usa `z-50` (linha 183). O phone widget já usa `z-[60]`. A separação vertical resolve a sobreposição sem conflito de z-index.

