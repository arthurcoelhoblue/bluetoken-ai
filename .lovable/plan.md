

## Mostrar nome completo da conexão + todos os botões na linha de cima

### Alterações

**`ConnectionPicker.tsx`**:
- Remover `max-w-[200px]` do `SelectTrigger` e do `Badge` — deixar o nome completo visível.
- Restaurar o `displayLabel` original que mostra label + display_phone + verified_name completo + "(padrão)".

**`ManualMessageInput.tsx`**:
- Manter o layout de 2 linhas (ações em cima, textarea + send embaixo).
- Na linha de cima, o ConnectionPicker fica com `flex-1 min-w-0` para ocupar o espaço disponível mas permitir shrink, e os 3 botões (anexar, áudio, template) ficam com `shrink-0` ao lado.
- Todos cabem porque a linha de baixo é exclusiva para o textarea.

