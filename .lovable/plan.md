

## Plano: Push de leads para Mautic e SGT em tempo real

### Resumo
Após criar contato + deal no `lp-lead-ingest`, enviar o lead para Mautic (API REST, Basic Auth) e SGT (`criar-lead-api`) em paralelo, fire-and-forget (não bloqueia a resposta do webhook).

### Pré-requisitos: Secrets
Precisamos armazenar 3 secrets novos:
- `MAUTIC_URL` → `https://mautic.grupoblue.com.br`
- `MAUTIC_USERNAME` → `automacao@grupoblue.com.br`
- `MAUTIC_PASSWORD` → a senha fornecida

O `SGT_WEBHOOK_SECRET` já existe. O endpoint do SGT é `https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/criar-lead-api` (mesmo host usado no `sgt-sync`).

### Implementação

**Arquivo:** `supabase/functions/lp-lead-ingest/index.ts`

Adicionar duas funções fire-and-forget no final do loop de cada lead (após o `results.push`):

1. **`pushToMautic(lead)`** — `POST /api/contacts/new` com Basic Auth
   - Mapeia: `firstname`, `lastname`, `email`, `phone`, `tags`, UTMs como campos customizados
   - Loga erro mas não falha o fluxo
   - Retorna o `mautic_contact_id` para referência no resultado

2. **`pushToSGT(lead, empresa)`** — `POST criar-lead-api` com `x-api-key`
   - Mapeia para o formato SGT: `nome_lead`, `email`, `telefone`, `origem_canal`, UTMs
   - Loga erro mas não falha o fluxo

Ambos executam em `Promise.allSettled()` para não adicionar latência sequencial e não bloquear a resposta.

### Resultado esperado no response
Cada item do `results[]` ganhará campos opcionais:
```json
{
  "email": "...",
  "status": "created",
  "mautic_status": "ok" | "error",
  "sgt_status": "ok" | "error"
}
```

### Mapeamento Mautic (API v2 Basic Auth)
```text
POST https://mautic.grupoblue.com.br/api/contacts/new
Authorization: Basic base64(user:pass)
Content-Type: application/json

{
  "firstname": lead.nome.split(" ")[0],
  "lastname": lead.nome.split(" ").slice(1).join(" "),
  "email": lead.email,
  "phone": lead.telefone,
  "tags": lead.tags,
  "utm_source": ...,
  "utm_medium": ...,
  "utm_campaign": ...
}
```

### Mapeamento SGT
```text
POST https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/criar-lead-api
x-api-key: <SGT_WEBHOOK_SECRET>

{
  "empresa": empresa,
  "lead": {
    "nome_lead": lead.nome,
    "email": lead.email,
    "telefone": lead.telefone,
    "origem_canal": lead.canal_origem || "AMELIA_CRM",
    "utm_source": ...,
    "utm_medium": ...,
    "utm_campaign": ...,
    "utm_content": ...,
    "utm_term": ...
  }
}
```

### Arquivos impactados
- `supabase/functions/lp-lead-ingest/index.ts` — adicionar push functions + chamada fire-and-forget

### Riscos / Observações
- Fire-and-forget: se Mautic/SGT estiver offline, o lead já está salvo na Amélia. O erro é logado mas não perde o lead.
- Mautic Basic Auth: a API v2 do Mautic aceita Basic Auth nativamente quando habilitado no painel (`Configuration > API Settings > Enable HTTP basic auth`).
- Sem retry automático nesta versão (pode ser adicionado depois com fila).

