

# Amélia Copilot — FAB Flutuante com Notificacao Proativa

## O que muda

O botao da Amélia Copilot sai da barra superior e vira um botao flutuante (FAB) no canto inferior direito, arrastavel pelo usuario. Quando a Amélia gerar insights proativos, uma "bolha" aparece ao lado do botao (estilo notificacao do WhatsApp) com o texto do insight mais recente.

## Arquitetura da mudanca

### 1. Novo componente: `CopilotFab.tsx`

Componente independente que encapsula:
- **Botao flutuante** com icone da Amélia (Bot) e badge de contagem
- **Drag-and-drop** usando `onPointerDown/Move/Up` nativo (sem dependencias extras)
- **Bolha de notificacao** que aparece quando `pendingCount` muda de 0 para N, mostrando o titulo do insight mais recente por 8 segundos
- Ao clicar no FAB, abre o Sheet (CopilotPanel) normalmente

Posicao inicial: `bottom: 24px, right: 24px` (logo acima do ZadarmaPhoneWidget que fica em `bottom: 6`).
Posicao salva em `localStorage` para persistir entre sessoes.

### 2. Alteracoes no `TopBar.tsx`

- Remover o `CopilotPanel` da barra superior (linha ~112)
- Remover o import e a chamada `getCopilotContext` (ja nao sera necessario aqui)

### 3. Alteracoes no `AppLayout.tsx`

- Adicionar `<CopilotFab />` ao lado do `<ZadarmaPhoneWidget />`
- O contexto sera derivado da rota via `useLocation()` dentro do proprio `CopilotFab`

### 4. Alteracoes no `CopilotPanel.tsx`

- Adicionar prop `externalOpen` e `onOpenChange` para controle externo do Sheet (o FAB controla abrir/fechar)
- Manter todo o restante intacto (mensagens, insights, suggestions)

## Bolha de notificacao (estilo WhatsApp)

```text
+------------------------------------------+
|  Amelia: "Deal X parado ha 5 dias"    X  |
+------------------------------------------+
          [Bot icon FAB]
```

- Aparece com animacao `animate-fade-in` quando ha novos insights
- Desaparece apos 8s ou ao clicar no X
- Maximo de 1 bolha por vez (insight mais recente/prioritario)

## Drag (arrastar)

- Implementado com `onPointerDown`, `onPointerMove`, `onPointerUp` nativos
- Sem bibliotecas extras (dnd-kit e para listas, nao para drag livre)
- Limites: mantem o botao dentro da viewport
- Posicao salva em `localStorage('copilot-fab-position')`
- Distingue click de drag: se mover menos de 5px, trata como click (abre o painel)

## Arquivos alterados

| Arquivo | Acao |
|---------|------|
| `src/components/copilot/CopilotFab.tsx` | **Novo** — FAB arrastavel + bolha de notificacao |
| `src/components/copilot/CopilotPanel.tsx` | Adicionar props `externalOpen`/`onOpenChange` |
| `src/components/layout/TopBar.tsx` | Remover CopilotPanel |
| `src/components/layout/AppLayout.tsx` | Adicionar CopilotFab |

## Seguranca

- Zero mudancas no backend
- Zero mudancas em banco de dados
- O `useCopilotInsights` continua funcionando exatamente igual
- O Sheet do CopilotPanel continua identico; apenas o trigger muda
- ZadarmaPhoneWidget nao e afetado (posicoes diferentes)
