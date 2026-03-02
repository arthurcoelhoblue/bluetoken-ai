

## Problema

O `connectionId` selecionado no `ConnectionPicker` não está sendo passado corretamente para o backend. Existem dois bugs:

1. **ConnectionPicker não notifica o pai quando há 2+ conexões**: O componente calcula `selectedId` internamente como fallback, mas só chama `onChange` automaticamente quando há exatamente 1 conexão. Com 2+ conexões (caso da Tokeniza), o estado `connectionId` no `ManualMessageInput` permanece `''`, e o backend usa a conexão `is_default = true` (o número errado).

2. **TemplatePickerDialog tem seu próprio `connectionId` independente**: Mesmo que o usuário selecione o número no input principal, ao abrir o Template Picker, ele tem seu próprio estado `connectionId` começando vazio, ignorando a seleção anterior.

### Conexões Tokeniza
| Label | phone_number_id | is_default |
|-------|-----------------|------------|
| *(sem label)* | 1009376255595711 | **true** |
| Comercial - Tokeniza BR | 1054747871049688 | false |

Quando `connectionId` vai vazio, o backend sempre usa `is_default = true` → número errado.

---

## Solução

### 1. ConnectionPicker: auto-notificar o pai ao montar com 2+ conexões

No `ConnectionPicker`, adicionar um `useEffect` que chama `onChange(defaultConn.id)` quando o componente monta e o pai ainda não tem valor selecionado. Isso garante que o `connectionId` do pai seja preenchido com a conexão padrão imediatamente.

### 2. ManualMessageInput: passar connectionId para o TemplatePickerDialog

Adicionar prop `connectionId` ao `TemplatePickerDialog` e usá-lo como valor inicial do estado interno do picker, para que a seleção do número principal seja respeitada ao abrir templates.

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `src/components/conversas/ConnectionPicker.tsx` | Adicionar `useEffect` para chamar `onChange` com o default ao montar |
| `src/components/conversas/TemplatePickerDialog.tsx` | Aceitar prop `initialConnectionId` e usar como valor inicial |
| `src/components/conversas/ManualMessageInput.tsx` | Passar `connectionId` para `TemplatePickerDialog` |

