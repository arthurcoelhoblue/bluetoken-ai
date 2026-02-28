

# Fix: usar `codigo` como nome do template na API Meta

## Problema
Na `amelia-mass-action`, o campo `metaTemplateName` é preenchido com `tmpl.meta_template_id` (ID numérico `2027547028193546`), mas a API da Meta espera o **nome** do template (`tokeniza_reengajamento`).

## Correção em `supabase/functions/amelia-mass-action/index.ts`

Duas ocorrências precisam ser corrigidas:

1. **Linha ~101** (template principal do job): trocar `metaTemplateName: tmpl.meta_template_id` por `metaTemplateName: tmpl.codigo`
2. **Linha ~140** (template sugerido por mensagem): trocar `metaTemplateName: sugTmpl.meta_template_id` por `metaTemplateName: sugTmpl.meta_template_id` — este já busca apenas `meta_template_id` no select, precisa adicionar `codigo` ao select e usar `sugTmpl.codigo` (ou manter `meta_template_id` se for o nome correto para templates sugeridos criados automaticamente)

### Mudanças concretas:

**Template principal (~linha 97-105):**
- O select já busca `codigo` — basta mudar: `metaTemplateName: tmpl.meta_template_id` → `metaTemplateName: tmpl.codigo`

**Template sugerido (~linha 133-143):**
- Adicionar `codigo` ao select
- Mudar: `metaTemplateName: sugTmpl.meta_template_id` → `metaTemplateName: sugTmpl.codigo || sugTmpl.meta_template_id` (templates auto-criados usam `codigo` como nome no Meta)

Depois: redeploy da edge function.

