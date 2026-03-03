

## Problema

A duplicação de template falha porque existe uma constraint `UNIQUE(empresa, codigo)` na tabela `message_templates`. Ao clonar, a função `handleClone` copia o `codigo` original sem alterá-lo, causando violação de chave duplicada.

## Solução

Modificar a função `handleClone` em `src/pages/TemplatesPage.tsx` para gerar um `codigo` diferente ao duplicar. A abordagem mais simples é adicionar o sufixo do `connection_id` (primeiros 4 caracteres) ao `codigo` original, garantindo unicidade.

## Mudança

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/TemplatesPage.tsx` | Na função `handleClone`, gerar um novo `codigo` com sufixo baseado no `connection_id` destino (ex: `codigo_original_ab12`) para evitar conflito de chave única |

O `codigo` clonado ficaria algo como: `meu_template_ab12` onde `ab12` são os primeiros 4 chars do connection_id destino.

