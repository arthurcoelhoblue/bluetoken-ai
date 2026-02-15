

# Correção: Email truncado mas totalmente copiável

## Problema
A classe `truncate` usa `overflow: hidden` + `text-overflow: ellipsis`, o que impede o usuário de copiar a parte oculta do email ao selecionar o texto.

## Solução
Adicionar a classe Tailwind `select-all` (`user-select: all`) nos elementos de email truncados. Isso faz com que, ao clicar no texto, **todo o conteúdo** seja selecionado automaticamente — incluindo a parte que não está visível. O usuário então copia normalmente com Ctrl+C.

Também adicionar o atributo `title` com o email completo, para que o hover mostre o valor inteiro como fallback visual.

## Arquivos a modificar

### 1. `src/components/pessoa/PessoaCard.tsx` (linha 89)
```
DE:  <p className="font-medium truncate">
PARA: <p className="font-medium truncate select-all cursor-pointer" title={pessoa.email_principal}>
```

### 2. `src/pages/LeadDetail.tsx` — email do contato
```
DE:  <span className="truncate">
PARA: <span className="truncate select-all cursor-pointer" title={contact.email}>
```

Duas alterações de uma linha cada. Nenhuma lógica adicional necessária.
