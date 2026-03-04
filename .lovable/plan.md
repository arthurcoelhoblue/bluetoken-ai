

## Diagnóstico

Os logs da Meta mostram claramente o erro:

> "As variáveis precisam estar no formato {{#}}, onde o número representa o índice da variável. Todas as variáveis precisam começar em {{1}}."

O problema está no fluxo de submissão individual de templates (POST single). O `handleSubmitToMeta` no `TemplatesPage.tsx` envia os `meta_components` diretamente como estão armazenados no banco, que contêm variáveis com nomes como `{{nome}}`, `{{oferta}}` etc. A Meta exige formato numérico: `{{1}}`, `{{2}}`.

O fluxo de **batch-submit** já tem essa conversão (linhas 104-112 do edge function), mas o fluxo de **submissão individual** (POST sem `action=batch-submit`, linhas 148-196) **não faz nenhuma conversão** — envia os components exatamente como recebidos.

## Correção

Adicionar a mesma lógica de conversão de variáveis no handler POST individual do `supabase/functions/whatsapp-template-manager/index.ts`. Antes de enviar para a Meta API (linha 162), processar cada componente BODY para:

1. Substituir `{{nome_variavel}}` por `{{1}}`, `{{2}}`, etc.
2. Prefixar com "Olá " se o texto começar com variável
3. Sufixar com "." se terminar com variável  
4. Gerar `example.body_text` com valores placeholder

A mudança é apenas no edge function, entre as linhas ~148-160, adicionando um bloco de normalização dos components antes do `fetch` à Meta API.

