# PATCH 5F-B – Configuração do Webhook Inbound WhatsApp

## Metadados
- **Data**: 2025-12-09
- **Épico**: Motor de Mensagens
- **Status**: 📋 Documentação
- **Dependências**: PATCH 5F (Webhook Inbound WhatsApp)

---

## 1. Objetivo

Documentar como configurar o sistema de mensageria externo (mensageria.grupoblue.com.br) para encaminhar mensagens de resposta dos leads para o SDR IA.

---

## 2. Endpoint do Webhook

```
POST https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/whatsapp-inbound
```

---

## 3. Autenticação

O webhook aceita autenticação via **qualquer um** dos seguintes headers:

| Header | Valor |
|--------|-------|
| `Authorization` | `Bearer <WHATSAPP_INBOUND_SECRET>` |
| `X-API-Key` | `<WHATSAPP_INBOUND_SECRET>` |

**IMPORTANTE**: O valor de `WHATSAPP_INBOUND_SECRET` deve ser configurado no painel de secrets do projeto Lovable e também na configuração do webhook na mensageria externa.

---

## 4. Formato do Payload

A mensageria externa deve enviar um POST com o seguinte formato JSON:

```json
{
  "from": "+5561998317422",
  "message_id": "wa-msg-unique-id-123",
  "timestamp": "2025-12-09T15:30:00Z",
  "text": "Texto da mensagem enviada pelo lead"
}
```

### Campos Obrigatórios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `from` | string | Número de telefone do remetente (formato: +55XXXXXXXXXXX ou XXXXXXXXXXX) |
| `message_id` | string | ID único da mensagem no WhatsApp (para evitar duplicatas) |
| `timestamp` | string | Data/hora da mensagem em formato ISO 8601 |
| `text` | string | Conteúdo textual da mensagem |

---

## 5. Normalização de Telefone

O sistema normaliza automaticamente o telefone recebido:

| Input | Output Normalizado |
|-------|-------------------|
| `+5561998317422` | `5561998317422` |
| `5561998317422` | `5561998317422` |
| `61998317422` | `5561998317422` |

---

## 6. Resposta do Webhook

### Sucesso (200)

```json
{
  "success": true,
  "messageId": "uuid-da-mensagem-salva",
  "leadId": "lead-id-encontrado",
  "runId": "run-id-ativa-ou-null",
  "status": "MATCHED"
}
```

### Status Possíveis

| Status | Descrição |
|--------|-----------|
| `MATCHED` | Lead encontrado e mensagem associada |
| `UNMATCHED` | Telefone não encontrado em lead_contacts |
| `DUPLICATE` | message_id já processado anteriormente |

### Erros

| Código | Descrição |
|--------|-----------|
| `401` | Unauthorized - Secret inválido ou ausente |
| `400` | Bad Request - Payload inválido |
| `500` | Internal Server Error - Erro no processamento |

---

## 7. Fluxo Após Recebimento

Quando uma mensagem inbound é recebida:

```
1. Autenticação do request
   ↓
2. Normalização do telefone
   ↓
3. Busca do lead em lead_contacts
   ↓
4. Se lead encontrado:
   a. Busca run ativa
   b. Registra evento RESPOSTA_DETECTADA
   ↓
5. Salva mensagem em lead_messages
   ↓
6. Dispara interpretação IA (sdr-ia-interpret)
   ↓
7. IA analisa e executa ações automáticas:
   - Pausar/cancelar cadência
   - Marcar opt-out
   - Enviar resposta automática
   - Escalar para humano
```

---

## 8. Teste Manual via cURL

Para testar o webhook manualmente:

```bash
# Substitua <WHATSAPP_INBOUND_SECRET> pelo valor real
curl -X POST https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/whatsapp-inbound \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <WHATSAPP_INBOUND_SECRET>" \
  -d '{
    "from": "+5561998317422",
    "message_id": "test-msg-'$(date +%s)'",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "text": "Olá, tenho interesse em saber mais sobre o investimento"
  }'
```

### Exemplos de Mensagens para Teste

| Cenário | Mensagem |
|---------|----------|
| Interesse | "Olá, tenho interesse em saber mais sobre o investimento" |
| Dúvida preço | "Qual o valor mínimo para investir?" |
| Opt-out | "Não quero mais receber mensagens, por favor me removam" |
| Agendamento | "Podemos marcar uma reunião para amanhã?" |
| Objeção | "Achei caro, não vou investir agora" |

---

## 9. Configuração na Mensageria Externa

### Passo a Passo

1. **Acessar painel da mensageria** (mensageria.grupoblue.com.br)

2. **Localizar configuração de webhook** para mensagens inbound

3. **Configurar URL do webhook**:
   ```
   https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/whatsapp-inbound
   ```

4. **Configurar headers de autenticação**:
   - Header: `Authorization`
   - Valor: `Bearer <WHATSAPP_INBOUND_SECRET>`

5. **Configurar formato do payload** conforme seção 4

6. **Ativar o webhook** e testar com uma mensagem de teste

---

## 10. Troubleshooting

### Mensagem não aparece no sistema

1. **Verificar logs da edge function**:
   - Acessar logs de `whatsapp-inbound` no painel Lovable
   - Procurar erros de autenticação ou parsing

2. **Verificar se telefone está cadastrado**:
   ```sql
   SELECT * FROM lead_contacts 
   WHERE telefone LIKE '%XXXXXXXXX'
   ```

3. **Verificar duplicatas**:
   ```sql
   SELECT * FROM lead_messages 
   WHERE whatsapp_message_id = 'message-id-esperado'
   ```

### Erro 401 Unauthorized

- Verificar se `WHATSAPP_INBOUND_SECRET` está configurado corretamente
- Confirmar que o header está sendo enviado: `Authorization: Bearer <secret>`

### Lead não identificado (UNMATCHED)

- Verificar normalização do telefone
- Confirmar que o lead existe em `lead_contacts` com o telefone correto

---

## 11. Monitoramento

### Query para verificar inbounds recentes

```sql
SELECT 
  lm.id,
  lm.lead_id,
  lm.conteudo,
  lm.estado,
  lm.created_at,
  lmi.intent,
  lmi.intent_confidence,
  lmi.acao_recomendada
FROM lead_messages lm
LEFT JOIN lead_message_intents lmi ON lmi.message_id = lm.id
WHERE lm.direcao = 'INBOUND'
ORDER BY lm.created_at DESC
LIMIT 20;
```

---

## 12. Arquivos Relacionados

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/whatsapp-inbound/index.ts` | Edge function do webhook |
| `supabase/functions/sdr-ia-interpret/index.ts` | Interpretação IA das mensagens |
| `docs/patches/PATCH-5F_whatsapp-inbound.md` | Documentação técnica original |
