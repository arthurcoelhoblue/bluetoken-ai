

## Tornar o botão flutuante do telefone arrastável (como o Copilot)

O FAB do telefone hoje é fixo em `fixed bottom-20 right-6`. Vamos aplicar a mesma lógica de drag que já existe no `CopilotFab`: posição salva no localStorage, drag com pointer events, threshold para distinguir clique de arraste, clamp no resize.

### Alterações em `ZadarmaPhoneWidget.tsx`

1. **Adicionar estado de posição + drag** (mesmo padrão do CopilotFab):
   - `STORAGE_KEY = 'phone-fab-position'`, `FAB_SIZE = 48`, `DRAG_THRESHOLD = 5`
   - Funções `loadPosition` / `savePosition` idênticas ao CopilotFab
   - Estado `position` inicializado do localStorage ou default `{ x: innerWidth - 48 - 24, y: innerHeight - 48 - 80 }` (um pouco acima do Copilot)
   - Refs: `isDraggingRef`, `dragStartRef`, `didDragRef`
   - Handlers: `onPointerDown`, `onPointerMove`, `onPointerUp` com clamp e threshold
   - `useEffect` para clamp no resize da janela

2. **FAB minimizado** (linhas ~258-279): trocar `fixed bottom-20 right-6` por `fixed` com `style={{ left: position.x, top: position.y }}` + adicionar `touch-none select-none` e os handlers de pointer no wrapper `div`, igual ao Copilot. O `onClick` do botão é substituído pelo `onPointerUp` (abre só se não arrastou).

3. **Widget expandido** (linha ~362): o painel compacto também usa posição relativa ao FAB. Posicionar com `style` calculado a partir de `position`, abrindo para cima/esquerda se estiver perto da borda inferior/direita.

4. **Evitar conflito com CopilotFab**: a posição default do telefone será `y: innerHeight - 48 - 80` (offset diferente do Copilot que usa `- 24`).

