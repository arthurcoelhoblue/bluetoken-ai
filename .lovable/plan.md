

## Bugs identificados no Widget de Telefonia

### Bug 1: Discagem automática ao abrir o widget (FAB)
Quando o widget é minimizado com um número preenchido (após uma chamada anterior), o `number` state permanece preenchido. Ao clicar no FAB para reabrir, o widget abre já com o número anterior. O problema real é que o evento `bluecrm:dial` chama `handleDialDirect` imediatamente -- ou seja, ao clicar no ClickToCallButton, a chamada é disparada instantaneamente sem dar chance de revisar. Porém, ao abrir o widget pelo FAB flutuante, o estado anterior do número é mantido e não há discagem automática errada. Vou verificar se o bug é que ao clicar no FAB com número preenchido, ele reabre mostrando a tela de chamada em andamento (`isInCall` = true se phoneState ficou preso).

Na verdade, olhando o fluxo: quando a chamada termina (`handleHangup`), após 2s o `phoneState` volta a `idle` mas o `number` **nunca é limpo**. Então o FAB fica pulsando (`minimized && number` na linha 248) e ao clicar reabre o dialpad com o número anterior preenchido. Isso não causa discagem automática.

O bug "discando antes do tempo" provavelmente se refere ao fato de que ao clicar no botão de telefone em um contato (ClickToCallButton), a chamada é iniciada **imediatamente** sem confirmação -- o `handleDial` é chamado direto no event handler. Isso é by design para preservar o user gesture chain para WebRTC, mas o usuário quer ver o número antes de confirmar.

### Bug 2: Falta o "+" no dialpad
O DIALPAD array não inclui o caractere `+`. Números internacionais precisam do prefixo `+`.

### Bug 3: Sem botão de apagar (backspace)
Não existe botão para apagar dígitos digitados incorretamente no dialpad.

---

## Plano de implementação

### 1. Adicionar botão "+" e botão backspace ao dialpad
- Alterar o layout do dialpad para incluir `+` à esquerda do `0` e um botão de backspace (ícone `Delete`) à direita do `#`
- O DIALPAD array passa a ser renderizado com uma linha extra ou substituir `*` e `#` por layout customizado
- Melhor abordagem: manter o grid 3x4 existente e adicionar uma 5a linha com `+`, `0`, `⌫` -- ou trocar para grid 3x5 reorganizado

Layout proposto (grid 3x5):
```
1  2  3
4  5  6
7  8  9
*  0  #
+  ⌫  (vazio ou ligar)
```

Na verdade, mais limpo: adicionar `+` antes do `*` na última linha e um botão backspace. Vou usar a abordagem de renderizar o dialpad manualmente com uma linha extra abaixo contendo `+` e backspace.

### 2. Não discar automaticamente ao receber evento bluecrm:dial
- Modificar o event handler para apenas preencher o número e abrir o widget, sem chamar `handleDialDirect`
- O usuário revisa o número e clica "Ligar" manualmente
- Mover o `AudioContext.resume()` do ClickToCallButton para o `handleDial` do widget para manter o user gesture chain

### 3. Limpar número após encerrar chamada
- No `handleHangup`, limpar `number`, `contactName` e `dealId` após o timeout de 2s

### Arquivos a editar
- `src/components/zadarma/ZadarmaPhoneWidget.tsx`: adicionar `+` e backspace ao dialpad, remover auto-dial do event listener, limpar estado após hangup
- `src/components/zadarma/ClickToCallButton.tsx`: manter AudioContext unlock mas remover a chamada direta (já que o widget vai lidar com isso)

