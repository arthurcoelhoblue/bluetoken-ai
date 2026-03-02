

## Correção: Variáveis nomeadas não detectadas no TemplatePickerDialog

### Problema

- **Blue** `conteudo`: `"Oi {{primeiro_nome}}, tudo bem?"` → regex `\{\{(\d+)\}\}` **não detecta**
- **Tokeniza** `conteudo`: `"Oi {{1}}, tudo bem?"` → regex **detecta**

O `TemplatePickerDialog` só procura `{{número}}` — variáveis nomeadas como `{{primeiro_nome}}` são ignoradas.

### Solução

Atualizar o `conteudo` dos 11 templates da Blue no banco para usar o formato numérico `{{1}}` (alinhado com o `meta_components.text`), já que a Meta usa `{{1}}`.

Além disso, como medida defensiva, atualizar o `TemplatePickerDialog` para detectar **ambos** os formatos: `{{1}}` e `{{nome_variavel}}`.

### Alterações

**1. Migration SQL** — Atualizar `conteudo` dos templates Blue de `{{primeiro_nome}}` para `{{1}}`

**2. `TemplatePickerDialog.tsx`** — Expandir o regex de extração de variáveis para capturar `{{palavra}}` além de `{{número}}`, exibindo campos para preenchimento em ambos os casos.

