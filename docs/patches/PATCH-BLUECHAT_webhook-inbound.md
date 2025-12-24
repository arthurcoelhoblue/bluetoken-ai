# PATCH – Webhook Blue Chat Inbound

## Metadados
- **Data**: 2025-06-21
- **Épico**: Integração Blue Chat
- **Status**: ✅ Implementado
- **Dependências**: SDR-IA Interpret

---

## 1. Objetivo

Criar webhook para integração entre Blue Chat e Amélia (SDR IA), permitindo que o Blue Chat:
1. Encaminhe leads comerciais para a Amélia processar
2. Receba respostas automáticas da Amélia
3. Saiba quando escalar para um humano
4. Mantenha rastreamento do lead no sistema

---

## 2. Arquitetura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  WhatsApp   │────▶│ Mensageria  │────▶│  Blue Chat  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                    Lead Comercial?
                                               │
                                               ▼
                                   ┌───────────────────┐
                                   │ bluechat-inbound  │
                                   │    (webhook)      │
                                   └─────────┬─────────┘
                                             │
                                             ▼
                                   ┌───────────────────┐
                                   │  sdr-ia-interpret │
                                   │     (Amélia)      │
                                   └─────────┬─────────┘
                                             │
                                             ▼
                                   ┌───────────────────┐
                                   │  Resposta JSON    │
                                   │  (para BlueChat)  │
                                   └───────────────────┘
```

---

## 3. Endpoint

```
POST https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/bluechat-inbound
```

### Autenticação

| Header | Valor |
|--------|-------|
| `Authorization` | `Bearer <BLUECHAT_WEBHOOK_SECRET>` |
| `X-API-Key` | `<BLUECHAT_WEBHOOK_SECRET>` |

---

## 4. Payload de Entrada

```typescript
interface BlueChatPayload {
  // Identificação do lead (pelo menos um obrigatório)
  telefone?: string;           // +5561999999999 ou 5561999999999
  email?: string;              // email do lead
  lead_id?: string;            // UUID do lead se já conhecido
  
  // Mensagem atual (OBRIGATÓRIO)
  mensagem: string;            // Texto da mensagem do cliente
  
  // Contexto da conversa (opcional mas recomendado)
  historico?: {
    direcao: 'INBOUND' | 'OUTBOUND';  // INBOUND = cliente, OUTBOUND = Amélia
    texto: string;
    timestamp?: string;               // ISO 8601
    autor?: string;                   // 'cliente' | 'amelia' | 'agente:[nome]'
  }[];
  
  // Metadados do Blue Chat
  bluechat?: {
    ticket_id?: string;        // ID do ticket/conversa no Blue Chat
    agent_id?: string;         // ID do agente que encaminhou
    canal_origem?: string;     // 'whatsapp' | 'email' | 'chat' | 'telegram'
    departamento?: string;     // 'comercial' | 'suporte' | 'financeiro'
    prioridade?: 'baixa' | 'normal' | 'alta' | 'urgente';
    tags?: string[];           // Tags associadas ao ticket
  };
  
  // Dados do lead (para criar/atualizar se necessário)
  lead_data?: {
    nome?: string;
    primeiro_nome?: string;
    empresa?: 'TOKENIZA' | 'BLUE';  // Default: BLUE
  };
  
  // Configurações de resposta
  config?: {
    retornar_resposta?: boolean;     // true = retorna resposta da Amélia (default: true)
    criar_lead_se_novo?: boolean;    // true = cria lead se não existir (default: true)
    webhook_resposta?: string;       // URL para enviar resposta async (opcional)
  };
}
```

---

## 5. Payload de Resposta

```typescript
interface BlueChatResponse {
  success: boolean;
  
  // IDs para rastreamento
  lead_id: string | null;
  message_id: string | null;
  intent_id: string | null;
  
  // Resposta da Amélia (quando disponível)
  resposta?: {
    texto: string;              // Mensagem para enviar ao cliente
    intent: string;             // INTERESSE_COMPRA, DUVIDA_PRODUTO, etc.
    confianca: number;          // 0-1 (confiança da classificação)
    acao_recomendada: string;   // NENHUMA, ESCALAR_HUMANO, etc.
    escalar_humano: boolean;    // true = precisa de intervenção humana
    motivo_escalar?: string;    // Motivo do escalonamento
  };
  
  // Status do lead
  lead_status?: {
    temperatura: string;        // FRIO, MORNO, QUENTE
    estado_funil: string;       // SAUDACAO, QUALIFICACAO, etc.
    empresa: string;            // BLUE, TOKENIZA
    criado_agora: boolean;      // true = lead foi criado nesta chamada
  };
  
  // Erro se houver
  error?: string;
}
```

---

## 6. Exemplos de Uso

### 6.1 Mensagem Simples

```bash
curl -X POST https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/bluechat-inbound \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <BLUECHAT_WEBHOOK_SECRET>" \
  -d '{
    "telefone": "+5561999999999",
    "mensagem": "Oi, quero saber sobre declaração de cripto"
  }'
```

**Resposta:**
```json
{
  "success": true,
  "lead_id": "uuid-do-lead",
  "message_id": "uuid-da-mensagem",
  "intent_id": "uuid-do-intent",
  "resposta": {
    "texto": "Olá! Que bom que você entrou em contato! A Blue tem planos específicos para declaração de criptomoedas...",
    "intent": "DUVIDA_PRODUTO",
    "confianca": 0.92,
    "acao_recomendada": "NENHUMA",
    "escalar_humano": false
  },
  "lead_status": {
    "temperatura": "MORNO",
    "estado_funil": "DIAGNOSTICO",
    "empresa": "BLUE",
    "criado_agora": false
  }
}
```

### 6.2 Com Histórico de Conversa

```bash
curl -X POST https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/bluechat-inbound \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <BLUECHAT_WEBHOOK_SECRET>" \
  -d '{
    "telefone": "+5561999999999",
    "mensagem": "Quero o plano Gold",
    "historico": [
      { "direcao": "OUTBOUND", "texto": "Olá! Como posso ajudar?" },
      { "direcao": "INBOUND", "texto": "Quero declarar meus criptos" },
      { "direcao": "OUTBOUND", "texto": "Temos os planos Gold e Diamond..." }
    ],
    "bluechat": {
      "ticket_id": "TICKET-12345",
      "canal_origem": "whatsapp",
      "departamento": "comercial"
    }
  }'
```

### 6.3 Novo Lead (Criação Automática)

```bash
curl -X POST https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/bluechat-inbound \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <BLUECHAT_WEBHOOK_SECRET>" \
  -d '{
    "telefone": "+5511888888888",
    "mensagem": "Olá, vi o anúncio sobre IR de cripto",
    "lead_data": {
      "nome": "João Silva",
      "empresa": "BLUE"
    },
    "config": {
      "criar_lead_se_novo": true
    }
  }'
```

**Resposta (lead criado):**
```json
{
  "success": true,
  "lead_id": "novo-uuid",
  "lead_status": {
    "temperatura": "FRIO",
    "estado_funil": "SAUDACAO",
    "empresa": "BLUE",
    "criado_agora": true
  }
}
```

---

## 7. Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 400 | Payload inválido (falta mensagem ou identificador) |
| 401 | Autenticação falhou |
| 404 | Lead não encontrado (quando `criar_lead_se_novo: false`) |
| 500 | Erro interno |

---

## 8. Quando Escalar para Humano

A Amélia retorna `escalar_humano: true` quando:

| Situação | Intent | Motivo |
|----------|--------|--------|
| Cliente quer falar com humano | SOLICITACAO_CONTATO | Pedido explícito |
| Reclamação grave | RECLAMACAO | Risco de churn |
| Lead muito quente | INTERESSE_COMPRA | Fechamento iminente |
| Dúvida técnica complexa | DUVIDA_TECNICA | Fora do escopo da IA |
| Objeção forte | OBJECAO_PRECO | Precisa negociação |

---

## 9. Fluxo no Blue Chat

```
1. Cliente envia mensagem no WhatsApp
   ↓
2. Mensageria recebe e encaminha para Blue Chat
   ↓
3. Blue Chat identifica como lead comercial
   (pode usar tags, palavras-chave, departamento)
   ↓
4. Blue Chat chama bluechat-inbound
   ↓
5. Amélia processa e retorna resposta
   ↓
6. Blue Chat verifica escalar_humano:
   - false → Envia resposta.texto ao cliente
   - true  → Alerta agente humano + opcionalmente envia resposta
   ↓
7. Blue Chat envia resposta via Mensageria → WhatsApp
```

---

## 10. Configuração

### Secret necessário

Adicionar no Supabase Secrets:
```
BLUECHAT_WEBHOOK_SECRET = [token-seguro-gerado]
```

### Configuração no Blue Chat

1. Criar webhook apontando para o endpoint
2. Configurar header `Authorization: Bearer <token>`
3. Mapear campos do Blue Chat para o payload
4. Configurar regra: "Se departamento = comercial → acionar webhook"

---

## 11. Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/bluechat-inbound/index.ts` | Edge function do webhook |
| `docs/patches/PATCH-BLUECHAT_webhook-inbound.md` | Esta documentação |

---

## 12. Próximos Passos

1. **Webhook de resposta async**: Implementar callback para quando Blue Chat não puder esperar resposta síncrona
2. **Métricas**: Dashboard de chamadas Blue Chat → Amélia
3. **Feedback loop**: Blue Chat informar quando agente humano corrige a Amélia
