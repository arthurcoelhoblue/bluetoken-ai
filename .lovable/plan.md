

## Integração Elementor → Amélia (com mapeamento configurável)

### Contexto

O Elementor Pro envia webhooks no formato `{"fields": {"field_id": {"value": "..."}}}` ou via hooks PHP customizados. O endpoint `lp-lead-ingest` espera `{"lead": {"nome": "...", "email": "..."}}`. Precisamos de uma camada intermediária que faça essa tradução de forma configurável por formulário.

### Arquitetura

```text
Elementor Form Submit
  → POST /functions/v1/elementor-webhook?form_id=abc123
    → Edge function lê mapeamento do DB
    → Converte campos do Elementor → formato LeadPayload
    → Chama lp-lead-ingest internamente (reutiliza lógica existente)
    → Retorna 200 ao Elementor
```

### O que será construído

**1. Tabela `elementor_form_mappings`** (migration)

Armazena a configuração de mapeamento por formulário:
- `id`, `form_id` (slug único, ex: "oferta-publica-2025")
- `empresa`, `pipeline_id`, `stage_id` (destino do lead)
- `field_map` (JSONB): mapeia campo do Elementor → campo do lead. Ex: `{"nome": "field_abc", "email": "field_def", "telefone": "field_ghi"}`
- `tags_auto` (text[]): tags automáticas aplicadas
- `token` (text): token de autenticação único por formulário
- `is_active` (boolean)
- RLS: acesso via service_role apenas (edge function)

**2. Edge function `elementor-webhook`** (`supabase/functions/elementor-webhook/index.ts`)

- Recebe POST com query param `?form_id=xxx`
- Autentica via header `X-Webhook-Token` comparando com o token do mapeamento
- Busca o mapeamento no DB pelo `form_id`
- Converte os campos recebidos para o formato `LeadPayload` usando o `field_map`
- Chama internamente a lógica do `lp-lead-ingest` (via fetch interno ou reutilizando a lógica extraída)
- Suporta tanto o formato nativo do Elementor (`fields.field_id.value`) quanto formato flat (`{"nome": "...", "email": "..."}`)
- Rate limiting via `webhook-rate-limit.ts`

**3. Tela de configuração na UI** (`src/components/settings/ElementorIntegrationManager.tsx`)

Dentro da aba Webhooks ou como seção dedicada:
- Listar mapeamentos existentes
- Criar novo mapeamento: selecionar empresa, pipeline, estágio, definir tags, gerar token
- Editor de mapeamento de campos (campo Amélia → ID do campo no Elementor)
- Gerar snippet pronto para colar no WordPress: URL + token + exemplo de hook PHP
- Botão "Testar webhook" que envia um payload de teste

**4. Registrar na lista de webhooks** (`src/types/settings.ts`)

Adicionar `elementor-webhook` ao array `WEBHOOKS`.

### Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabela `elementor_form_mappings` |
| `supabase/functions/elementor-webhook/index.ts` | Criar — endpoint de recepção |
| `src/components/settings/ElementorIntegrationManager.tsx` | Criar — UI de configuração e mapeamento |
| `src/components/settings/WebhooksTab.tsx` | Modificar — adicionar seção Elementor |
| `src/types/settings.ts` | Modificar — adicionar webhook à lista |

