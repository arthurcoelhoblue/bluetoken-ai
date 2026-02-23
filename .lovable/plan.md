

## Corrigir botao "Ver contato" para abrir a ficha completa do contato

### Problema
O botao ExternalLink no DealDetailHeader navega para `/contatos?contact=${contactId}`, mas a pagina de Contatos escuta o parametro `?open=` (nao `?contact=`). Isso significa que ao clicar no botao, a pagina abre mas a ficha do contato nao e exibida.

### Solucao
Corrigir o parametro de query no `DealDetailHeader.tsx` de `?contact=` para `?open=`, alinhando com o que a `ContatosPage` ja espera.

### Arquivo alterado

**`src/components/deals/DealDetailHeader.tsx`** (linha 129)

Antes:
```
navigate(`/contatos?contact=${contactId}`);
```

Depois:
```
navigate(`/contatos?open=${contactId}`);
```

Mudanca de uma unica linha. Ao clicar no botao, o usuario sera levado para a pagina de Contatos com a ficha lateral (ContactDetailSheet) ja aberta, permitindo editar todos os campos do contato diretamente.

