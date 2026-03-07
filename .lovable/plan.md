
# Copiar API Key Preview na Tabela

## Contexto

A API Key completa só é exibida uma vez no momento da criação (por segurança, apenas o hash é armazenado). Na tabela, só temos o `key_preview` (últimos 8 caracteres). O que podemos fazer é tornar o preview clicável para copiar.

## Alteração

**Arquivo:** `src/components/settings/ApiKeysManager.tsx`

Na coluna "Preview" da tabela (linha ~180-182), substituir o `<code>` estático por um botão clicável que copia o preview e mostra feedback visual (ícone Copy → Check):

- Envolver o `<code>` com um `<button>` estilizado com cursor pointer e tooltip
- Ao clicar, copiar `...{key_preview}` para o clipboard
- Mostrar ícone de `Copy` ao lado, que muda para `Check` por 2 segundos após copiar
- Toast de confirmação "Preview copiado!"

Também adicionar um botão de copiar na coluna de ações, ao lado dos botões existentes de toggle e delete.

## Nota importante

A chave completa não pode ser recuperada após a criação (apenas o hash é armazenado no banco). Se o usuário precisar da chave completa novamente, deverá gerar uma nova.
