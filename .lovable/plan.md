

## Substituir "LP_COM_IA" pelo nome da página de origem

### Situação atual
Quando o Elementor webhook envia um lead para o `lp-lead-ingest`, o campo `canal_origem` é sempre gravado como `"LP_COM_IA"` (hardcoded) tanto no contato quanto no deal. O `page_url` já é capturado pelo webhook mas fica enterrado dentro de `campos_extras`.

### Plano

**1. `elementor-webhook/index.ts`** — Extrair o nome da página do `page_url` e enviar como `canal_origem` no payload:
- Pegar `camposExtras.page_url` (já é capturado automaticamente)
- Extrair o pathname legível (ex: `https://site.com/direito-digital/` → `direito-digital`)
- Passar no payload do lead como um novo campo `canal_origem`

**2. `lp-lead-ingest/index.ts`** — Aceitar `canal_origem` opcional no `LeadPayload`:
- Adicionar `canal_origem?: string` à interface `LeadPayload`
- No insert do contact e do deal, usar `lead.canal_origem || "LP_COM_IA"` como fallback

### Resultado
- Deals vindos do Elementor terão `canal_origem` = nome da página (ex: `direito-digital`)
- Leads vindos de outras origens que não passam `canal_origem` continuam com `"LP_COM_IA"`

### Arquivos afetados
- `supabase/functions/elementor-webhook/index.ts`
- `supabase/functions/lp-lead-ingest/index.ts`

