

## Fase 3: Webhook Meta Cloud — Inbound Messages + Status Updates

### Contexto
O `whatsapp-inbound` atual recebe payloads simplificados (provavelmente do Blue Chat/Baileys). A Meta Cloud API envia webhooks com formato próprio (nested entries/changes). Precisamos criar um novo endpoint dedicado que:
1. Responda ao **webhook verification** da Meta (GET com `hub.verify_token`)
2. Processe **mensagens inbound** (type: messages)
3. Processe **status updates** (type: statuses — sent, delivered, read, failed)
4. Atualize `last_inbound_at` na `lead_conversation_state` para manter a janela 24h

### Implementação

**1. Nova Edge Function `meta-webhook/index.ts`**
- `GET` → Webhook verification da Meta (`hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`)
- `POST` → Processa webhook events:
  - **messages**: Extrai `from`, `id`, `timestamp`, `text.body` → normaliza telefone → salva em `lead_messages` (reutilizando lógica do `whatsapp-inbound`) → atualiza `last_inbound_at` → dispara `sdr-ia-interpret`
  - **statuses**: Extrai `id`, `status` (sent/delivered/read/failed) → atualiza `lead_messages.estado` pelo `whatsapp_message_id`
- Secret: `META_WEBHOOK_VERIFY_TOKEN` para validação do handshake
- Validação de assinatura via `X-Hub-Signature-256` (HMAC SHA256 com `META_APP_SECRET`)

**2. Atualizar `supabase/config.toml`**
- Adicionar `[functions.meta-webhook]` com `verify_jwt = false`

**3. Atualizar `lead_conversation_state.last_inbound_at`**
- No handler de mensagens inbound, fazer upsert do `last_inbound_at` para o lead encontrado (valida janela 24h da Fase 2)

**4. Mapeamento de Status Meta → Estado interno**
| Meta Status | `lead_messages.estado` |
|-------------|----------------------|
| sent | ENVIADO |
| delivered | ENTREGUE |
| read | LIDO |
| failed | FALHA |

**5. Frontend — Adicionar webhook na lista de settings**
- Novo entry em `WEBHOOKS` no `src/types/settings.ts` para `meta-webhook`

### Arquivos impactados
| Arquivo | Ação |
|---------|------|
| `supabase/functions/meta-webhook/index.ts` | **Novo** — handler GET+POST |
| `supabase/config.toml` | Adicionar `meta-webhook` |
| `src/types/settings.ts` | Novo webhook entry |

### Detalhes técnicos

Payload Meta (mensagem):
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WABA_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "phone_number_id": "..." },
        "messages": [{
          "from": "5561998317422",
          "id": "wamid.xxx",
          "timestamp": "1234567890",
          "type": "text",
          "text": { "body": "Olá" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

Payload Meta (status):
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "statuses": [{
          "id": "wamid.xxx",
          "status": "delivered",
          "timestamp": "1234567890"
        }]
      }
    }]
  }]
}
```

