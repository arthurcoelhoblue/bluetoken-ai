# PATCH Blue Chat – Webhook Inbound (Atendente Passiva)

## Metadados
- **Data**: 2026-02-09
- **Épico**: Integração Blue Chat
- **Status**: ✅ Implementado (v2 - Modo Passivo)
- **Dependências**: PATCH 5F (WhatsApp Inbound), PATCH 5G (SDR IA Interpret)

---

## 1. Objetivo

Integrar o Blue Chat (plataforma central de comunicação) com a Amélia (SDR IA) como **atendente passiva**:
1. Receber mensagens de leads comerciais escalados pelo atendimento do Blue Chat
2. Criar leads automaticamente se não existirem
3. Interpretar mensagens via SDR IA em **modo PASSIVE_CHAT** (sem cadências, sem SGT)
4. Retornar resposta consultiva para o Blue Chat
5. Escalar para humano quando detectar sinais quentes

---

## 2. Arquitetura

```
WhatsApp → Mensageria → Blue Chat → bluechat-inbound → SDR IA
                                          ↓
                                    Resposta → Blue Chat → Mensageria → WhatsApp
```

---

## 3. Endpoint

```
POST /functions/v1/bluechat-inbound
```

### Autenticação

| Header | Valor |
|--------|-------|
| `Authorization` | `Bearer <WHATSAPP_INBOUND_SECRET>` |
| `X-API-Key` | `<WHATSAPP_INBOUND_SECRET>` |

---

## 4. Payload de Entrada

```json
{
  "conversation_id": "bc-conv-123",
  "ticket_id": "ticket-456",
  "message_id": "bc-msg-456",
  "timestamp": "2025-01-10T14:23:00Z",
  "channel": "WHATSAPP",
  "contact": {
    "phone": "+5561998317422",
    "name": "João Silva",
    "email": "joao@email.com"
  },
  "message": {
    "type": "text",
    "text": "Quero saber sobre declaração de IR"
  },
  "context": {
    "empresa": "BLUE",
    "agent_id": "amelia",
    "tags": ["comercial", "ir"],
    "history_summary": "Cliente perguntou sobre prazos anteriormente"
  }
}
```

### Campos Obrigatórios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `conversation_id` | string | ID da conversa no Blue Chat |
| `message_id` | string | ID único da mensagem |
| `contact.phone` | string | Telefone do contato |
| `message.text` | string | Conteúdo da mensagem |

### Campos Opcionais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `timestamp` | string | ISO timestamp (default: now) |
| `channel` | string | WHATSAPP, EMAIL, SMS (default: WHATSAPP) |
| `contact.name` | string | Nome do contato |
| `contact.email` | string | Email do contato |
| `context.empresa` | string | TOKENIZA ou BLUE (default: BLUE) |
| `context.agent_id` | string | ID do agente (amelia) |
| `context.tags` | string[] | Tags da conversa |
| `context.history_summary` | string | Resumo do histórico |

---

## 5. Resposta

```json
{
  "success": true,
  "conversation_id": "bc-conv-123",
  "message_id": "uuid-da-mensagem",
  "lead_id": "uuid-do-lead",
  "action": "RESPOND",
  "response": {
    "text": "Olá João! Fico feliz com seu interesse...",
    "suggested_next": "Continuar qualificação"
  },
  "intent": {
    "detected": "INTERESSE_IR",
    "confidence": 0.92,
    "lead_ready": false
  },
  "escalation": {
    "needed": false,
    "reason": null,
    "priority": null
  }
}
```

### Campos da Resposta

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `action` | string | RESPOND, ESCALATE, ou QUALIFY_ONLY |
| `response.text` | string | Texto da resposta da Amélia |
| `intent.detected` | string | Intenção detectada |
| `intent.lead_ready` | boolean | Se lead está pronto para closer |
| `escalation.needed` | boolean | Se precisa escalar para humano |
| `escalation.priority` | string | LOW, MEDIUM, HIGH, URGENT |

---

## 6. Fluxo de Processamento (Modo Passivo)

```
1. Validar autenticação (BLUECHAT_API_KEY)
   ↓
2. Normalizar telefone (+5561998317422 → 5561998317422)
   ↓
3. Buscar lead em lead_contacts
   ↓
4. Se não encontrar → CRIAR lead automaticamente
   ↓
5. NÃO buscar cadência (run_id = null)
   ↓
6. Salvar mensagem em lead_messages (sem vínculo a cadência)
   ↓
7. Chamar sdr-ia-interpret com mode=PASSIVE_CHAT
   ↓
8. Retornar resposta consultiva para Blue Chat
   ↓
9. Se ESCALATE e ticket_id → transferir ticket via API
```

---

## 7. Criação Automática de Lead

Quando um telefone não é encontrado no sistema:

1. Cria registro em `lead_contacts` com:
   - `lead_id`: UUID gerado
   - `empresa`: do context ou BLUE (default)
   - `nome`, `email`: do payload
   - `telefone_e164`: normalizado
   - `origem_telefone`: 'BLUECHAT'

2. Cria classificação inicial em `lead_classifications`:
   - `icp`: BLUE_NAO_CLASSIFICADO ou TOKENIZA_NAO_CLASSIFICADO
   - `temperatura`: MORNO
   - `prioridade`: 5 (média)

---

## 8. Ações do Blue Chat

| Action | Quando Usar |
|--------|-------------|
| `RESPOND` | Amélia gerou resposta - enviar ao cliente |
| `ESCALATE` | Precisa intervenção humana - notificar closer |
| `QUALIFY_ONLY` | Apenas registrou - sem resposta automática |

---

## 9. Como Testar

```bash
curl -X POST https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/bluechat-inbound \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <WHATSAPP_INBOUND_SECRET>" \
  -d '{
    "conversation_id": "test-conv-001",
    "message_id": "test-msg-001",
    "timestamp": "2025-01-10T14:23:00Z",
    "channel": "WHATSAPP",
    "contact": {
      "phone": "+5561998317422",
      "name": "Lead Teste",
      "email": "teste@email.com"
    },
    "message": {
      "type": "text",
      "text": "Quero saber sobre declaração de imposto de renda"
    },
    "context": {
      "empresa": "BLUE",
      "agent_id": "amelia"
    }
  }'
```

---

## 10. Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/bluechat-inbound/index.ts` | Edge function do webhook |
| `docs/patches/PATCH-BLUECHAT_webhook-inbound.md` | Documentação |

### Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/config.toml` | Adicionado `bluechat-inbound` com `verify_jwt = false` |

---

## 11. Configuração no Blue Chat

Para configurar o webhook no Blue Chat:

1. **URL**: `https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/bluechat-inbound`
2. **Método**: POST
3. **Headers**:
   - `Content-Type: application/json`
   - `Authorization: Bearer <WHATSAPP_INBOUND_SECRET>`
4. **Trigger**: Quando conversa for marcada como "comercial" ou "lead"

---

## 12. Próximos Passos

1. Configurar Blue Chat para chamar o webhook
2. Implementar envio de resposta da Amélia de volta ao WhatsApp via Blue Chat
3. Dashboard de monitoramento de conversas Blue Chat
