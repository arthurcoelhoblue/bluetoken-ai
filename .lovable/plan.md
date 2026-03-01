

# Remover auto-criação de contacts do sgt-webhook

## Mudança

No `supabase/functions/sgt-webhook/index.ts`, linhas 214-265: o bloco "AUTO-CRIAÇÃO / MERGE DE CONTATO CRM" será simplificado.

**Remover:**
- Import e chamada de `findOrCreateContact` (linhas 225-247) — não cria mais contacts novos
- Toda a branch `if (!existingContact)` que cria contact via dedup

**Manter:**
- Busca de contact existente via `pessoa_id` + `empresa` (linha 218-223)
- Merge de dados faltantes em contact existente (linhas 249-260) — se o contact já existe, enriquece email/telefone

**Resultado:** Se o SGT envia dados de um lead que ainda não tem contact CRM, os dados ficam em `lead_contacts` (staging). O contact será criado quando o lead entrar pelo formulário de captura. Se já existe contact, o webhook enriquece com dados novos.

## Arquivo
- `supabase/functions/sgt-webhook/index.ts` — remover branch de criação, manter merge

