

# Auto-dial ao clicar em "Ligar" nos contatos, deals e leads

## Problema atual

O `ClickToCallButton` (usado em deals, contatos, leads, CS) apenas abre o widget flutuante e preenche o número — o usuário ainda precisa clicar "Ligar" manualmente no widget. O comportamento esperado é que a ligação seja iniciada automaticamente.

## Correção em `src/components/zadarma/ZadarmaPhoneWidget.tsx`

### 1. Adicionar flag para auto-dial após evento `bluecrm:dial`
- Criar um ref `autoDialRef` que é setado como `true` quando o evento `bluecrm:dial` é recebido
- Adicionar um `useEffect` que observa mudanças no `number` e, quando `autoDialRef.current === true`, chama `handleDial()` automaticamente
- Resetar o flag após o dial ser disparado

### 2. Fluxo resultante
- Usuário clica no ícone de telefone em qualquer lugar (deal, contato, lead, CS)
- `ClickToCallButton` dispara evento `bluecrm:dial`
- Widget recebe evento → seta número, nome, dealId → abre widget
- `useEffect` detecta que `autoDialRef` está ativo + número preenchido → chama `handleDial()` automaticamente
- Ligação inicia sem clique adicional

### Detalhes técnicos
- O `handleDial` depende do state `number` que é atualizado assincronamente via `setNumber`, por isso não pode ser chamado diretamente no handler do evento
- Um `useEffect` com dependência em `number` + verificação do ref resolve o timing
- O ref é necessário para distinguir entre digitação manual (não auto-dial) e clique no botão de contato (auto-dial)

