

## Problema

O `useGrabScroll` já existe mas está sendo bloqueado porque a exclusão `[data-sortable]` e `.deal-card` cobre praticamente toda a superfície visível do board. Na prática, só funciona em pequenos espaços entre colunas. O usuário quer poder clicar **em qualquer lugar** do board e arrastar horizontalmente para navegar o carrossel.

## Solução

Permitir que o grab scroll funcione **em toda a superfície do board**, inclusive sobre cards, diferenciando a intenção do usuário pelo **eixo de movimento**:

- **Movimento horizontal** (dx > dy) → scroll do carrossel (grab scroll)
- **Movimento vertical ou sobre card** → dnd-kit drag (mover deal entre colunas)

### Alterações

**1. `src/hooks/useGrabScroll.ts`**

- Remover `.deal-card` e `[data-sortable]` da lista de exclusão (manter apenas `button, a, input, textarea, select, [role="button"]`)
- Adicionar lógica de "lock de eixo": nos primeiros pixels de movimento, determinar se a intenção é horizontal (scroll) ou vertical (ignorar e deixar dnd-kit assumir)
- Quando o eixo horizontal é detectado, chamar `e.preventDefault()` e `e.stopPropagation()` para impedir que o dnd-kit interprete como drag de card

**2. `src/components/pipeline/KanbanBoard.tsx`**

- Aumentar o `distance` do `PointerSensor` de 5 para 8px, dando mais margem para o grab scroll "ganhar" a corrida de ativação
- Passar o `scrollRef` para o hook com configuração de threshold (ex: 8px) para determinar o eixo

### Lógica de detecção de eixo

```text
mousedown → registra posição inicial
mousemove (primeiros 8px):
  ├─ |dx| > |dy| → LOCK horizontal → grab scroll ativo, bloqueia dnd-kit
  └─ |dy| >= |dx| → RELEASE → para de interceptar, dnd-kit assume normalmente
```

Isso permite que o usuário arraste horizontalmente de qualquer ponto do board para navegar, e arraste verticalmente (ou sobre um card) para mover deals entre colunas.

| Arquivo | Ação |
|---------|------|
| `src/hooks/useGrabScroll.ts` | Remover exclusões de cards, adicionar lock de eixo horizontal |
| `src/components/pipeline/KanbanBoard.tsx` | Aumentar distance do PointerSensor para 8px |

