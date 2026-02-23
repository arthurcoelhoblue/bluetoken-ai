

# Dar vida aos e-mails da cadencia

## Problema

Os e-mails enviados pela Amelia chegam como texto puro com `<br>` no lugar de quebras de linha. Sem cores, sem logo, sem estrutura visual -- parece um rascunho, nao um e-mail profissional.

## Solucao

Criar um wrapper HTML profissional no `cadence-runner` que envolve o conteudo do template antes de enviar ao `email-send`. O wrapper sera responsivo, compativel com clientes de e-mail (Gmail, Outlook, Apple Mail) e alinhado com a identidade visual de cada empresa (Blue e Tokeniza).

## Design do template

```text
+---------------------------------------------+
|  [Logo Blue / Tokeniza]                      |
+---------------------------------------------+
|                                              |
|  Ola Arthur,                                 |
|                                              |
|  Sou a Amelia, da Blue...                    |
|                                              |
|  **O que fazemos:** ...                      |
|  **Por que a Blue?** ...                     |
|                                              |
|  [ Agendar conversa ]  <-- botao CTA         |
|                                              |
+---------------------------------------------+
|  Amelia | SDR Blue                           |
|  grupoblue.com.br                            |
+---------------------------------------------+
```

## Detalhes tecnicos

### 1. Criar modulo de template HTML

**Novo arquivo**: `supabase/functions/_shared/email-template.ts`

Funcao `wrapEmailHtml(content, empresa, leadNome?)` que:
- Recebe o conteudo em texto/markdown e a empresa
- Converte `**texto**` para `<strong>texto</strong>`
- Converte bullet points (`•` ou `- `) em lista HTML
- Envolve tudo em um template HTML inline-styled (email-safe)
- Aplica cores da marca:
  - **Blue**: azul escuro `#1a365d`, accent `#2b6cb0`
  - **Tokeniza**: verde/dourado da marca
- Inclui header com nome da empresa estilizado
- Inclui footer com assinatura da Amelia e links
- Layout responsivo via tabelas (compatibilidade email)

### 2. Alterar cadence-runner

**Arquivo**: `supabase/functions/cadence-runner/index.ts` (linhas 348-370)

Substituir a conversao simples:
```
html: htmlBody.replace(/\n/g, '<br>')
```

Por:
```
html: wrapEmailHtml(htmlBody, empresa)
```

O `text` continua sendo o conteudo puro (para clientes que nao suportam HTML).

### 3. Estrutura do HTML

O template usara:
- **Tabelas inline-styled** (padrao para email, sem CSS externo)
- **Fundo branco** no body (compatibilidade dark mode)
- **Largura maxima** de 600px centralizada
- **Header**: barra colorida com nome da empresa
- **Body**: conteudo com tipografia limpa (font-family: Arial, sans-serif)
- **Negrito**: parsing de `**texto**` para `<strong>`
- **Listas**: parsing de linhas com `•` para `<ul><li>`
- **Footer**: assinatura estilizada, separador, links discretos
- **Botao CTA** opcional quando detectar convite de agendamento

### 4. Template de teste existente

O template `BLUE_EMAIL_TESTE` ja usa HTML basico (`<h1>`, `<p>`). O wrapper detectara se o conteudo ja e HTML (comeca com `<`) e, nesse caso, aplicara apenas o envelope externo sem re-processar o conteudo.

## Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/_shared/email-template.ts` | Novo -- wrapper HTML |
| `supabase/functions/cadence-runner/index.ts` | Alterar -- usar wrapper |

## Resultado

Os e-mails da Amelia chegarao com visual profissional, cores da marca, tipografia limpa e estrutura clara -- sem alterar nenhum conteudo dos templates existentes no banco.

