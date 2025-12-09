# Guia de Testes E2E - SDR IA

## Status: Implementado
**Data:** 2025-12-09

## Pré-requisitos Verificados

### Secrets ✅
- `SGT_WEBHOOK_SECRET` - Configurado
- `WHATSAPP_INBOUND_SECRET` - Configurado  
- `WHATSAPP_API_KEY` - Configurado
- `LOVABLE_API_KEY` - Configurado (para IA)
- `CRON_SECRET` - Configurado

### Cadências Ativas ✅
```
TOKENIZA_INBOUND_LEAD_NOVO
TOKENIZA_MQL_QUENTE
BLUE_INBOUND_LEAD_NOVO  
BLUE_IR_URGENTE
```

### Modo de Teste
- `whatsapp-send` está em `TEST_MODE = true`
- Todas as mensagens são enviadas para: `+55 61 99831-7422` (Arthur)

---

## Cenário 1: TOKENIZA - Lead com Interesse em Investir

### Passo 1: Criar lead via SGT

```bash
curl -X POST "https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/sgt-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SGT_WEBHOOK_SECRET" \
  -d '{
    "lead_id": "lead-teste-tokeniza-1",
    "evento": "LEAD_NOVO",
    "empresa": "TOKENIZA",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "nome": "Arthur Teste Tokeniza",
    "email": "arthur.tokeniza+teste1@example.com",
    "telefone": "+5561999990001",
    "utm_source": "teste",
    "utm_campaign": "sdr-ia-e2e",
    "dados_tokeniza": {
      "valor_investido": 15000,
      "qtd_investimentos": 3
    }
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "event_id": "uuid",
  "classification": {
    "icp": "TOKENIZA_EMERGENTE",
    "temperatura": "MORNO",
    "prioridade": 3
  },
  "cadence": {
    "codigo": "TOKENIZA_INBOUND_LEAD_NOVO",
    "run_id": "uuid"
  }
}
```

### Passo 2: Executar cadence-runner

```bash
curl -X POST "https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/cadence-runner" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

### Passo 3: Simular resposta do lead (interesse)

```bash
curl -X POST "https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/whatsapp-inbound" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WHATSAPP_INBOUND_SECRET" \
  -d '{
    "from": "+5561999990001",
    "message_id": "wa-msg-tokeniza-001",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "text": "Achei interessante esse investimento, quero entender como faço pra investir"
  }'
```

### Validação Cenário 1

```sql
-- Verificar intent
SELECT intent, intent_confidence, acao_recomendada, resposta_automatica_texto
FROM lead_message_intents 
WHERE lead_id = 'lead-teste-tokeniza-1'
ORDER BY created_at DESC LIMIT 1;
-- Esperado: intent = 'INTERESSE_COMPRA', confidence > 0.7

-- Verificar temperatura
SELECT temperatura, prioridade, icp 
FROM lead_classifications 
WHERE lead_id = 'lead-teste-tokeniza-1';
-- Esperado: temperatura = 'QUENTE' (ajustada automaticamente)

-- Verificar mensagens
SELECT direcao, estado, conteudo 
FROM lead_messages 
WHERE lead_id = 'lead-teste-tokeniza-1'
ORDER BY created_at DESC;
-- Esperado: 1 INBOUND + 1 OUTBOUND (resposta auto)

-- Verificar eventos de tarefa
SELECT tipo_evento, template_codigo, detalhes 
FROM lead_cadence_events lce
JOIN lead_cadence_runs lcr ON lce.lead_cadence_run_id = lcr.id
WHERE lcr.lead_id = 'lead-teste-tokeniza-1'
ORDER BY lce.created_at DESC;
-- Esperado: RESPOSTA_DETECTADA com template_codigo = 'SDR_IA_TAREFA_CLOSER'
```

---

## Cenário 2: BLUE - Interesse em IR Cripto

### Passo 1: Criar lead BLUE

```bash
curl -X POST "https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/sgt-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SGT_WEBHOOK_SECRET" \
  -d '{
    "lead_id": "lead-teste-blue-1",
    "evento": "LEAD_NOVO",
    "empresa": "BLUE",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "nome": "Arthur Teste Blue",
    "email": "arthur.blue+teste1@example.com",
    "telefone": "+5561999990002",
    "dados_blue": {
      "ticket_medio": 5000,
      "score_mautic": 35
    }
  }'
```

### Passo 2: Simular interesse em IR

```bash
curl -X POST "https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/whatsapp-inbound" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WHATSAPP_INBOUND_SECRET" \
  -d '{
    "from": "+5561999990002",
    "message_id": "wa-msg-blue-001",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "text": "Tenho operações em cripto e preciso resolver meu imposto de renda, como funciona o serviço de vocês?"
  }'
```

### Validação Cenário 2

```sql
SELECT intent, intent_confidence, acao_recomendada
FROM lead_message_intents 
WHERE lead_id = 'lead-teste-blue-1';
-- Esperado: intent = 'INTERESSE_IR', confidence > 0.7, acao inclui CRIAR_TAREFA_CLOSER
```

---

## Cenário 3: Opt-Out

### Passo: Simular opt-out

```bash
curl -X POST "https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/whatsapp-inbound" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WHATSAPP_INBOUND_SECRET" \
  -d '{
    "from": "+5561999990001",
    "message_id": "wa-msg-optout-001",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "text": "Não quero mais receber essas mensagens, por favor parem de me chamar"
  }'
```

### Validação Cenário 3

```sql
-- Verificar opt-out marcado
SELECT opt_out, opt_out_em, opt_out_motivo 
FROM lead_contacts 
WHERE lead_id = 'lead-teste-tokeniza-1';
-- Esperado: opt_out = true

-- Verificar cadências canceladas
SELECT status FROM lead_cadence_runs 
WHERE lead_id = 'lead-teste-tokeniza-1';
-- Esperado: status = 'CANCELADA'

-- Verificar intent
SELECT intent, acao_recomendada, resposta_automatica_texto
FROM lead_message_intents 
WHERE message_id IN (
  SELECT id FROM lead_messages WHERE whatsapp_message_id = 'wa-msg-optout-001'
);
-- Esperado: intent = 'OPT_OUT', resposta_automatica_texto = NULL
```

---

## Cenário 4: Objeção de Preço

### Passo: Simular objeção

```bash
curl -X POST "https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/whatsapp-inbound" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WHATSAPP_INBOUND_SECRET" \
  -d '{
    "from": "+5561999990002",
    "message_id": "wa-msg-blue-obj-preco-001",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "text": "Achei o serviço caro demais, não sei se compensa pagar isso por imposto de renda"
  }'
```

### Validação Cenário 4

```sql
SELECT intent, acao_recomendada, resposta_automatica_texto
FROM lead_message_intents 
WHERE message_id IN (
  SELECT id FROM lead_messages WHERE whatsapp_message_id = 'wa-msg-blue-obj-preco-001'
);
-- Esperado: 
--   intent = 'OBJECAO_PRECO'
--   acao_recomendada = 'CRIAR_TAREFA_CLOSER'
--   resposta_automatica_texto = NULL (não responde automaticamente sobre preço)
```

---

## Cenário 5: Mensagem Ambígua

### Passo: Simular mensagem confusa

```bash
curl -X POST "https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/whatsapp-inbound" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WHATSAPP_INBOUND_SECRET" \
  -d '{
    "from": "+5561999990003",
    "message_id": "wa-msg-ambigua-001",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "text": "Esse negócio aí que você mandou, não sei, talvez, quem sabe, se for bom, mas também não sei se serve pra mim"
  }'
```

**Nota:** Este lead não existe ainda, então será registrado como UNMATCHED.

### Validação Cenário 5

```sql
-- Para leads existentes:
SELECT intent, intent_confidence, acao_recomendada, resposta_automatica_texto
FROM lead_message_intents 
WHERE message_id IN (
  SELECT id FROM lead_messages WHERE whatsapp_message_id = 'wa-msg-ambigua-001'
);
-- Esperado:
--   intent_confidence < 0.6
--   acao_recomendada = 'NENHUMA' ou 'ESCALAR_HUMANO'
--   resposta_automatica_texto = NULL
```

---

## Checklist de Aprovação

| Cenário | Status | Observação |
|---------|--------|------------|
| TOKENIZA – interesse investimento → resposta auto + tarefa + quente | ☐ | |
| BLUE – interesse IR → resposta auto + tarefa + quente | ☐ | |
| Opt-out → marca contato + cancela cadências + bloqueio envio | ☐ | |
| Objeção de preço → tarefa para closer, sem resposta auto | ☐ | |
| Mensagem ambígua → sem resposta auto, no máximo tarefa | ☐ | |

---

## Queries Úteis para Debug

```sql
-- Últimos intents processados
SELECT lmi.*, lm.conteudo as mensagem_original
FROM lead_message_intents lmi
JOIN lead_messages lm ON lmi.message_id = lm.id
ORDER BY lmi.created_at DESC
LIMIT 10;

-- Estado das cadências por lead
SELECT lcr.lead_id, lcr.empresa, lcr.status, c.nome as cadencia
FROM lead_cadence_runs lcr
JOIN cadences c ON lcr.cadence_id = c.id
WHERE lcr.lead_id LIKE 'lead-teste%'
ORDER BY lcr.created_at DESC;

-- Mensagens trocadas por lead
SELECT lead_id, direcao, estado, conteudo, created_at
FROM lead_messages
WHERE lead_id LIKE 'lead-teste%'
ORDER BY lead_id, created_at;

-- Eventos de cadência
SELECT lcr.lead_id, lce.tipo_evento, lce.template_codigo, lce.detalhes, lce.created_at
FROM lead_cadence_events lce
JOIN lead_cadence_runs lcr ON lce.lead_cadence_run_id = lcr.id
WHERE lcr.lead_id LIKE 'lead-teste%'
ORDER BY lce.created_at DESC;
```

---

## Limpeza de Dados de Teste

```sql
-- ATENÇÃO: Execute apenas em ambiente de teste!
DELETE FROM lead_message_intents WHERE lead_id LIKE 'lead-teste%';
DELETE FROM lead_cadence_events WHERE lead_cadence_run_id IN (
  SELECT id FROM lead_cadence_runs WHERE lead_id LIKE 'lead-teste%'
);
DELETE FROM lead_cadence_runs WHERE lead_id LIKE 'lead-teste%';
DELETE FROM lead_messages WHERE lead_id LIKE 'lead-teste%';
DELETE FROM lead_classifications WHERE lead_id LIKE 'lead-teste%';
DELETE FROM lead_contacts WHERE lead_id LIKE 'lead-teste%';
DELETE FROM sgt_event_logs WHERE event_id IN (
  SELECT id FROM sgt_events WHERE lead_id LIKE 'lead-teste%'
);
DELETE FROM sgt_events WHERE lead_id LIKE 'lead-teste%';
```
