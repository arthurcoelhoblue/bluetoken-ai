---
sidebar_position: 7
title: Webhooks
---

# Integração via Webhooks

## Webhooks de Entrada

### SGT Webhook (`sgt-webhook`)

Recebe leads do Sistema de Gestão de Tráfego:

- **Autenticação** via token no header
- **Validação** de payload com schema
- **Normalização** de dados (telefone E.164, etc.)
- **Classificação** comercial automática
- **Inserção** em cadência apropriada

### BlueChat Inbound (`bluechat-inbound`)

Recebe mensagens do chat do site:

- **Resolução de contato** (cria ou encontra existente)
- **Triagem** da mensagem
- **Bridge para SDR-IA** quando apropriado
- **Rate limiting** por IP/telefone

### WhatsApp Inbound (`whatsapp-inbound`)

Recebe mensagens do WhatsApp Business API.

### Elementor Webhook (`elementor-webhook`)

Recebe leads de formulários WordPress/Elementor com mapeamento configurável:

- **Autenticação** via `X-Webhook-Token` por formulário
- **Mapeamento dinâmico** de campos (configurável na UI)
- **Suporte** a formato nativo do Elementor (`fields.field_id.value`) e formato flat
- **Encaminhamento** automático para `lp-lead-ingest`
- **Rate limiting** por token
- **UTM tracking** via body ou query params

## Rate Limiting

Webhooks usam rate limiting compartilhado via `webhook-rate-limit.ts`:

```typescript
// Limite configurável por endpoint
// Window de 1 minuto por padrão
// Retorna 429 quando excedido
```
