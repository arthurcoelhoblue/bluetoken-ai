

## Diagnóstico: Inbound Retorna 401

A Mensageria está chamando o webhook, mas a autenticação falha. O log confirma "Token inválido" na última chamada.

### Causa Provável
O `validateAuth()` só aceita `Authorization: Bearer <token>` e `X-API-Key`. A Mensageria pode enviar em outro header (ex: `apikey`, `token`, query param, etc).

### Plano de Correção

**1. Adicionar logging de debug nos headers recebidos**
- Em `whatsapp-inbound/index.ts`, logar quais headers chegam antes de validar, para identificar exatamente como a Mensageria envia o token

**2. Ampliar `validateAuth()` para aceitar mais formatos**
- Adicionar suporte a headers comuns: `apikey`, `token`, `x-webhook-secret`
- Aceitar query param `?key=<secret>` como fallback
- Manter os formatos atuais (`Authorization: Bearer`, `X-API-Key`)

**3. Deploy e teste**
- Fazer deploy da edge function atualizada
- Pedir para o usuário enviar nova mensagem do celular
- Monitorar logs para confirmar que a autenticação passa

### Detalhes Técnicos

Arquivo: `supabase/functions/whatsapp-inbound/index.ts`

Na função `validateAuth()`, adicionar antes da validação:
```typescript
// Debug: logar todos os headers para identificar formato
const headerNames = [...req.headers.keys()];
log.info('Headers recebidos', { headers: headerNames });
```

E expandir os checks:
```typescript
// Aceitar mais formatos de header
const xWebhookSecret = req.headers.get('x-webhook-secret');
if (xWebhookSecret === inboundSecret) return true;

const apiKeyLower = req.headers.get('apikey');
if (apiKeyLower === inboundSecret) return true;
```

