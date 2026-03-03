

## Integração LP com IA → Amélia CRM

### Conceito

Criar um sistema de **API Keys** na Amélia que gera tokens seguros por empresa. O LP com IA recebe esse token e, ao configurá-lo como automação no editor de fluxos, consegue buscar dinamicamente os pipelines e etapas disponíveis via API, sem precisar digitar IDs manualmente.

```text
┌─────────────────┐         ┌──────────────────────┐
│   LP com IA     │         │     Amélia CRM       │
│                 │         │                      │
│ AutomationNode  │──GET───▶│ /api-keys/meta       │
│ (tipo: amelia)  │         │ (pipelines, stages)  │
│                 │         │                      │
│ Form Conversion │──POST──▶│ /lp-lead-ingest      │
│                 │         │ (com api_key header)  │
└─────────────────┘         └──────────────────────┘
```

### O que muda em cada projeto

**Amélia (este projeto):**

1. **Nova tabela `api_keys`** — armazena tokens gerados, vinculados a empresa, com label, permissões e data de expiração opcional
2. **Nova edge function `api-keys-manage`** — CRUD de API keys (gerar, listar, revogar) para admins autenticados
3. **Nova edge function `api-keys-meta`** — endpoint público (autenticado via API key) que retorna pipelines e stages da empresa vinculada ao token. Isso permite que o LP com IA popule selects dinâmicos
4. **Atualizar `lp-lead-ingest`** — aceitar autenticação via header `X-API-Key` além do Bearer token atual. Validar a key contra a tabela, resolver empresa/pipeline automaticamente
5. **UI em /admin/settings** — nova seção "API Keys" na aba de integrações para gerar e gerenciar tokens. Exibe o token uma vez, depois só mostra parcialmente

**LP com IA (outro projeto):**

6. **Novo tipo de automação "Amélia CRM"** no `AutomationNodeProperties` — campo para colar o API Key, selects dinâmicos de empresa (se multi-tenant), pipeline e etapa, buscados via `api-keys-meta`
7. **Executor do fluxo** — ao processar nó do tipo "amelia", faz POST para o endpoint `lp-lead-ingest` com o header `X-API-Key`

### Segurança

- Tokens são UUIDs v4 com hash SHA-256 armazenado no banco (o valor original só é mostrado uma vez na geração)
- Cada key tem scope de empresa — não é possível enviar leads para empresa diferente da vinculada
- Keys podem ser revogadas instantaneamente
- Rate limiting via tabela existente `rate_limit_log`
- RLS na tabela `api_keys` restrito a admins

### Tabela `api_keys`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | ID |
| empresa | empresa_tipo | Empresa vinculada |
| label | text | Nome descritivo |
| key_hash | text | SHA-256 do token |
| key_preview | text | Últimos 8 chars para identificação |
| permissions | text[] | Ex: ['lead:write', 'meta:read'] |
| created_by | uuid FK profiles | Quem gerou |
| expires_at | timestamptz | Expiração opcional |
| is_active | boolean | Revogar sem deletar |
| last_used_at | timestamptz | Auditoria |
| created_at | timestamptz | |

### Ordem de implementação

1. Criar tabela + RLS + edge functions (Amélia)
2. UI de gerenciamento de API Keys (Amélia)
3. Atualizar lp-lead-ingest para aceitar X-API-Key (Amélia)
4. Adicionar tipo "Amélia" no editor de fluxos (LP com IA)

