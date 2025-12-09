# PATCH 5F – Webhook Inbound WhatsApp

## Metadados
- **Data**: 2024-12-09
- **Épico**: Motor de Mensagens
- **Status**: ✅ Implementado
- **Dependências**: PATCH 5A (Infraestrutura de Mensagens)

---

## 1. Objetivo

Permitir que o sistema SDR IA:
1. Receba mensagens de WhatsApp enviadas pelos leads
2. Registre essas mensagens no histórico (`lead_messages`)
3. Resolva automaticamente o lead associado ao número
4. Relacione a mensagem com a run de cadência ativa (se houver)
5. Prepare o pipeline para interpretação IA no PATCH 5G

---

## 2. Endpoint

```
POST /functions/v1/whatsapp-inbound
```

### Autenticação

| Header | Valor |
|--------|-------|
| `Authorization` | `Bearer <WHATSAPP_INBOUND_SECRET>` |
| `X-API-Key` | `<WHATSAPP_INBOUND_SECRET>` |

### Payload

```json
{
  "from": "+5561998317422",
  "message_id": "wa-msg-123",
  "timestamp": "2025-01-10T14:23:00Z",
  "text": "Oi, queria entender melhor"
}
```

### Resposta

```json
{
  "success": true,
  "messageId": "uuid-da-mensagem",
  "leadId": "lead-id-ou-null",
  "runId": "run-id-ou-null",
  "status": "MATCHED" | "UNMATCHED" | "DUPLICATE"
}
```

---

## 3. Fluxo de Processamento

```
1. Validar autenticação (WHATSAPP_INBOUND_SECRET)
   ↓
2. Normalizar telefone (+5561998317422 → 5561998317422)
   ↓
3. Buscar lead em lead_contacts pelo telefone
   ↓
4. Se lead encontrado:
   a. Buscar run ativa em lead_cadence_runs
   b. Registrar evento RESPOSTA_DETECTADA
   ↓
5. Salvar mensagem em lead_messages
   - direcao: 'INBOUND'
   - estado: 'RECEBIDO' ou 'UNMATCHED'
   ↓
6. (PATCH 5G) Disparar interpretação IA
```

---

## 4. Normalização de Telefone

```typescript
function normalizePhone(raw: string): string {
  let normalized = raw.replace(/\D/g, '');
  
  // Se tiver 11 dígitos (sem DDI), adiciona 55
  if (normalized.length === 11) {
    normalized = '55' + normalized;
  }
  
  return normalized;
}
```

| Input | Output |
|-------|--------|
| `+5561998317422` | `5561998317422` |
| `5561998317422` | `5561998317422` |
| `61998317422` | `5561998317422` |

---

## 5. Busca de Lead

A busca é feita em duas etapas:

1. **Match exato**: `telefone = '5561998317422'`
2. **Match parcial**: `telefone LIKE '%61998317422'` (últimos 11 dígitos)

---

## 6. Estados da Mensagem

| Estado | Descrição |
|--------|-----------|
| `RECEBIDO` | Lead identificado, mensagem associada |
| `UNMATCHED` | Número não encontrado em lead_contacts |
| `DUPLICATE` | message_id já processado anteriormente |

---

## 7. Evento de Cadência

Quando uma mensagem inbound é recebida de um lead com run ativa:

```json
{
  "tipo_evento": "RESPOSTA_DETECTADA",
  "step_ordem": 0,
  "template_codigo": "INBOUND_RESPONSE",
  "detalhes": {
    "message_id": "uuid",
    "whatsapp_message_id": "wa-msg-123",
    "preview": "Oi, queria entender..."
  }
}
```

---

## 8. Migration Aplicada

```sql
-- lead_id pode ser null para mensagens UNMATCHED
ALTER TABLE lead_messages ALTER COLUMN lead_id DROP NOT NULL;

-- Coluna para timestamp original do inbound
ALTER TABLE lead_messages ADD COLUMN recebido_em timestamptz;

-- Índices para performance
CREATE INDEX idx_lead_contacts_telefone ON lead_contacts(telefone);
CREATE INDEX idx_lead_messages_whatsapp_id ON lead_messages(whatsapp_message_id);
CREATE INDEX idx_lead_cadence_runs_lead_status ON lead_cadence_runs(lead_id, status);
```

---

## 9. Q&A de Testes

### Autenticação

| Teste | Resultado Esperado |
|-------|-------------------|
| Sem header Authorization | 401 |
| Secret incorreto | 401 |
| Secret correto | 200 |

### Resolução de Lead

| Teste | Resultado Esperado |
|-------|-------------------|
| Telefone cadastrado | status: MATCHED, leadId preenchido |
| Telefone não cadastrado | status: UNMATCHED, leadId: null |
| Mensagem duplicada | status: DUPLICATE |

### Integração com Cadência

| Teste | Resultado Esperado |
|-------|-------------------|
| Lead com run ativa | runId preenchido, evento RESPOSTA_DETECTADA |
| Lead sem run ativa | runId: null |

---

## 10. Como Testar

```bash
curl -X POST https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/whatsapp-inbound \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <WHATSAPP_INBOUND_SECRET>" \
  -d '{
    "from": "+5561998317422",
    "message_id": "test-msg-001",
    "timestamp": "2025-01-10T14:23:00Z",
    "text": "Oi, queria entender melhor sobre o investimento"
  }'
```

---

## 11. Próximos Passos (PATCH 5G)

1. **Interpretação IA**: Analisar texto e extrair intenção
2. **Classificação**: INTERESSE, DUVIDA, RECUSA, AGENDAMENTO
3. **Ações automáticas**: Pausar cadência, escalar para humano, responder

---

## 12. Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/whatsapp-inbound/index.ts` | Edge function do webhook |
| `docs/patches/PATCH-5F_whatsapp-inbound.md` | Documentação |

### Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/config.toml` | Adicionado `whatsapp-inbound` com `verify_jwt = false` |
| `lead_messages` | `lead_id` nullable, coluna `recebido_em` |
