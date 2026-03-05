

## Reorganizar layout do input de mensagem

O layout atual coloca tudo em uma única linha (`flex items-end gap-2`): ConnectionPicker + Textarea + MediaAttachments + Template + Send. Quando o nome da conexão é longo (ex: "Comercial - Tokeniza BR · +5561995262818 · (padrão)"), ele comprime o textarea.

### Novo layout (2 linhas)

```text
┌─────────────────────────────────────────────────────┐
│ [ConnectionPicker ▼]  [Anexar]  [Template]          │  ← linha de ações
├─────────────────────────────────────────────────────┤
│ [  Textarea ........................................│ [Enviar] │  ← linha de digitação
└─────────────────────────────────────────────────────┘
```

**Linha 1 (topo)**: ConnectionPicker (com `max-w-[200px]` e texto truncado), botão de anexo (MediaAttachments), botão de template — todos alinhados horizontalmente sem sobreposição.

**Linha 2 (baixo)**: Textarea ocupa toda a largura com o botão Enviar ao lado.

### Alterações

**`ManualMessageInput.tsx`**:
- Trocar o `div flex items-end gap-2` único por dois `div` empilhados verticalmente (`space-y-2`).
- Linha 1: ConnectionPicker + MediaAttachments + botão Template, com `flex items-center gap-2 flex-wrap`.
- Linha 2: Textarea + botão Send, com `flex items-end gap-2`.

**`ConnectionPicker.tsx`**:
- No `SelectTrigger`, adicionar `max-w-[200px]` e truncar o texto exibido para que não ocupe espaço demais. No `displayLabel`, encurtar exibindo apenas o label (ou telefone curto) + "(padrão)", sem o verified_name junto.
- No badge (caso de 1 conexão), também limitar largura com `max-w-[200px] truncate`.

