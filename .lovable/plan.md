

## Garantir que FABs (Telefone e Copilot) fiquem sempre acima de dialogs/sheets

### Problema
Os dialogs e sheets do Radix UI usam portals que criam overlays em `z-50` com `fixed inset-0`, capturando todos os eventos de pointer. Apesar dos FABs estarem em `z-[60]`, o portal do Radix pode criar um novo stacking context que bloqueia a interação.

### Solução
Aumentar o `z-index` dos FABs para `z-[9999]` — um valor bem acima de qualquer dialog, sheet ou overlay do sistema. Isso garante que ambos os botões flutuantes fiquem sempre clicáveis e arrastáveis, independente de qual painel esteja aberto.

### Alterações

**`src/components/zadarma/ZadarmaPhoneWidget.tsx`**:
- Trocar todas as ocorrências de `z-[60]` por `z-[9999]` (FAB minimizado, FAB com número, widget expandido e overlay maximizado).

**`src/components/copilot/CopilotFab.tsx`**:
- Trocar `z-[60]` por `z-[9999]` no bubble de texto e em qualquer wrapper do FAB.

Isso são mudanças de apenas uma classe CSS em cada arquivo, sem alterar lógica ou layout.

