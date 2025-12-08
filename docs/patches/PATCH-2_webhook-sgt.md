# 📦 PATCH 2 - Webhook SGT + Normalizador

**Data:** 2025-12-08  
**Épico:** O Sistema Passa a "Ouvir" o SGT  
**Status:** ✅ Implementado

---

## 🎯 Objetivo

Permitir que o SDR IA seja acionado automaticamente pelo SGT (Sistema de Gestão de Tráfego) através de webhooks. Quando o SGT gerar um evento, o sistema recebe, valida, normaliza e processa, iniciando o fluxo do SDR IA.

---

## 📁 Arquivos Criados/Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/types/sgt.ts` | Novo | Tipos TypeScript para payload SGT |
| `supabase/functions/sgt-webhook/index.ts` | Novo | Edge function do webhook |
| `supabase/config.toml` | Modificado | Configuração da function (JWT disabled) |
| `docs/README.md` | Novo | Índice da documentação |
| `docs/CHANGELOG.md` | Novo | Log de mudanças |
| `docs/TEST-RESULTS.md` | Novo | Resultados de testes |
| `docs/patches/_TEMPLATE.md` | Novo | Template para patches |
| `docs/patches/PATCH-1_*.md` | Novo | Documentação retroativa Patch 1 |
| `docs/patches/PATCH-2_*.md` | Novo | Esta documentação |

---

## 🗄️ Alterações no Banco de Dados

### Enums Criados

```sql
-- Tipos de evento SGT
CREATE TYPE public.sgt_evento_tipo AS ENUM (
  'LEAD_NOVO',
  'ATUALIZACAO',
  'CARRINHO_ABANDONADO',
  'MQL',
  'SCORE_ATUALIZADO',
  'CLIQUE_OFERTA',
  'FUNIL_ATUALIZADO'
);

-- Empresas
CREATE TYPE public.empresa_tipo AS ENUM ('TOKENIZA', 'BLUE');

-- Status de processamento
CREATE TYPE public.sgt_event_status AS ENUM ('RECEBIDO', 'PROCESSADO', 'ERRO');
```

### Tabelas Criadas

```sql
-- Tabela principal de eventos SGT
CREATE TABLE public.sgt_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  empresa empresa_tipo NOT NULL,
  evento sgt_evento_tipo NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  recebido_em TIMESTAMPTZ DEFAULT now(),
  processado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de logs de auditoria
CREATE TABLE public.sgt_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES sgt_events(id) ON DELETE CASCADE,
  status sgt_event_status NOT NULL,
  mensagem TEXT,
  erro_stack TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Índices

```sql
CREATE INDEX idx_sgt_events_lead_id ON public.sgt_events(lead_id);
CREATE INDEX idx_sgt_events_empresa ON public.sgt_events(empresa);
CREATE INDEX idx_sgt_events_evento ON public.sgt_events(evento);
CREATE INDEX idx_sgt_events_recebido_em ON public.sgt_events(recebido_em);
CREATE INDEX idx_sgt_events_idempotency ON public.sgt_events(idempotency_key);
CREATE INDEX idx_sgt_event_logs_event_id ON public.sgt_event_logs(event_id);
CREATE INDEX idx_sgt_event_logs_status ON public.sgt_event_logs(status);
```

### RLS Policies

| Tabela | Policy | Comando | Descrição |
|--------|--------|---------|-----------|
| sgt_events | Admins can view all events | SELECT | Admin vê todos eventos |
| sgt_events | Service can insert events | INSERT | Service role insere |
| sgt_events | Service can update events | UPDATE | Service role atualiza |
| sgt_event_logs | Admins can view all event logs | SELECT | Admin vê todos logs |
| sgt_event_logs | Service can insert event logs | INSERT | Service role insere |

---

## 📦 Payload SGT (Contrato de Dados)

```json
{
  "lead_id": "string",
  "evento": "LEAD_NOVO | ATUALIZACAO | CARRINHO_ABANDONADO | MQL | SCORE_ATUALIZADO | CLIQUE_OFERTA | FUNIL_ATUALIZADO",
  "empresa": "TOKENIZA | BLUE",
  "timestamp": "2025-01-01T12:00:00Z",

  "dados_lead": {
    "nome": "string",
    "email": "string",
    "telefone": "string",
    "utm_source": "string",
    "utm_medium": "string",
    "utm_campaign": "string",
    "utm_term": "string",
    "score": 45,
    "stage": "Contato Iniciado | Negociação | Perdido | Cliente"
  },

  "dados_tokeniza": {
    "valor_investido": 25000,
    "qtd_investimentos": 7,
    "qtd_projetos": 5,
    "ultimo_investimento_em": "2024-11-20"
  },

  "dados_blue": {
    "qtd_compras_ir": 2,
    "ticket_medio": 1800,
    "score_mautic": 38,
    "plano_atual": "IR_CRIPTO_GOLD"
  },

  "event_metadata": {
    "oferta_id": "XYZ123",
    "valor_simulado": 5000,
    "pagina_visitada": "/ofertas/xyz123"
  }
}
```

---

## ⚙️ Funcionalidades Implementadas

### PATCH 2.1 - Endpoint /sgt/webhook
1. ✅ Endpoint POST `/functions/v1/sgt-webhook`
2. ✅ Validação de assinatura HMAC SHA-256
3. ✅ Validação de payload (campos obrigatórios)
4. ✅ Idempotência (evento não processado duas vezes)
5. ✅ Registro de evento bruto no banco

### PATCH 2.2 - Normalizador de Dados
6. ✅ Função `normalizeSGTEvent(payload)`
7. ✅ Tratamento de campos opcionais
8. ✅ Limpeza e formatação de dados (telefone, email)
9. ✅ Separação de dados por empresa

### PATCH 2.3 - Pipeline de Classificação
10. ✅ Stub para `classificarLead(lead_id, dados_normalizados)`
11. ⏳ Implementação completa (Épico 3/4)

### PATCH 2.4 - Logs e Auditoria
12. ✅ Tabela `sgt_event_logs`
13. ✅ Status: RECEBIDO, PROCESSADO, ERRO
14. ✅ Captura de stack trace em erros

---

## 🧪 Testes

| # | Teste | Cenário | Resultado Esperado | Status |
|---|-------|---------|-------------------|--------|
| 1 | SGT envia LEAD_NOVO | POST com payload válido | Endpoint aceita e registra evento | ✅ Passou |
| 2 | Payload inválido | POST sem lead_id | Rejeitar com 400 | ✅ Passou |
| 3 | Assinatura incorreta | Header x-sgt-signature errado | Rejeitar com 401 | ✅ Passou |
| 4 | Evento duplicado | Mesmo lead_id + evento + timestamp | Ignorar (idempotência) | ✅ Passou |
| 5 | Pipeline de classificação | Evento válido processado | Registro criado em logs | ✅ Passou |
| 6 | Dados TOKENIZA | Payload com dados_tokeniza | Normalizador extrai corretamente | ✅ Passou |
| 7 | Dados BLUE | Payload com dados_blue | Normalizador extrai corretamente | ✅ Passou |
| 8 | Payload parcial | Campos opcionais ausentes | Campos tratados com defaults | ✅ Passou |

---

## 🔧 Configurações Necessárias

- [x] Secret `SGT_WEBHOOK_SECRET` configurado
- [x] Edge function com `verify_jwt = false`
- [ ] SGT configurado para enviar webhooks

---

## 📊 Diagrama de Fluxo

```mermaid
sequenceDiagram
    participant SGT as SGT (Sistema Externo)
    participant WH as sgt-webhook
    participant DB as Database
    participant CL as Classificador

    SGT->>WH: POST /sgt-webhook
    Note right of SGT: Headers: x-sgt-signature, x-sgt-timestamp
    
    WH->>WH: Valida assinatura HMAC
    alt Assinatura inválida
        WH-->>SGT: 401 Unauthorized
    end
    
    WH->>WH: Valida payload
    alt Payload inválido
        WH-->>SGT: 400 Bad Request
    end
    
    WH->>DB: Verifica idempotência
    alt Evento duplicado
        WH-->>SGT: 200 OK (já processado)
    end
    
    WH->>DB: INSERT sgt_events
    WH->>DB: INSERT sgt_event_logs (RECEBIDO)
    
    WH->>WH: normalizeSGTEvent()
    WH->>CL: classificarLead()
    
    alt Sucesso
        WH->>DB: UPDATE processado_em
        WH->>DB: INSERT sgt_event_logs (PROCESSADO)
        WH-->>SGT: 200 OK
    else Erro
        WH->>DB: INSERT sgt_event_logs (ERRO)
        WH-->>SGT: 200 OK (evento salvo)
    end
```

---

## 🔐 Segurança

### Validação de Assinatura HMAC

O SGT deve enviar:
- Header `x-sgt-signature`: HMAC SHA-256 do payload
- Header `x-sgt-timestamp`: Unix timestamp em segundos

Formato da assinatura:
```
HMAC-SHA256(secret, "${timestamp}.${body}")
```

Validações:
- Timestamp não pode ter mais de 5 minutos de diferença
- Assinatura deve corresponder ao cálculo

### Exemplo de Geração (Node.js)

```javascript
const crypto = require('crypto');

function generateSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify(payload);
  const signaturePayload = `${timestamp}.${body}`;
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');
  
  return { signature, timestamp };
}

// Uso
const { signature, timestamp } = generateSignature(payload, 'seu-secret');
// Headers: x-sgt-signature: signature, x-sgt-timestamp: timestamp
```

---

## 📝 Como Testar

### Teste Local (sem assinatura)

```bash
curl -X POST https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/sgt-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "lead_123",
    "evento": "LEAD_NOVO",
    "empresa": "TOKENIZA",
    "timestamp": "2025-01-01T12:00:00Z",
    "dados_lead": {
      "nome": "João Silva",
      "email": "joao@email.com",
      "telefone": "(11) 99999-9999",
      "score": 75,
      "stage": "Contato Iniciado"
    },
    "dados_tokeniza": {
      "valor_investido": 50000,
      "qtd_investimentos": 3,
      "qtd_projetos": 2
    }
  }'
```

### Resposta Esperada

```json
{
  "success": true,
  "event_id": "uuid-do-evento",
  "lead_id": "lead_123",
  "evento": "LEAD_NOVO",
  "empresa": "TOKENIZA"
}
```

---

## 🔗 Dependências

- **PATCH 1** - Autenticação Google + RBAC (para visualização de eventos no dashboard)
