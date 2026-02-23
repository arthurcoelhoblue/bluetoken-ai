

## Adicionar barra de rolagem na lista de contatos do "Novo Deal"

### Problema
A lista de contatos dentro do combobox de busca no dialog "Novo Deal" nao possui altura maxima definida, fazendo com que listas longas fiquem cortadas sem possibilidade de rolagem.

### Solucao
Adicionar `className="max-h-[200px]"` ao componente `CommandList` (linha 197 do `CreateDealDialog.tsx`). O `CommandList` do cmdk ja suporta scroll interno -- basta limitar a altura.

### Arquivo alterado
- `src/components/pipeline/CreateDealDialog.tsx` -- adicionar `className="max-h-[200px]"` no `<CommandList>`

### Detalhe tecnico
```tsx
// Antes
<CommandList>

// Depois
<CommandList className="max-h-[200px] overflow-y-auto">
```

Mudanca de uma unica linha, sem impacto em outros componentes.
