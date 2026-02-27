
# Plano: Aceitar X-Webhook-Signature como metodo de autenticacao

## Problema

O gateway do Supabase modifica o valor do header `Authorization: Bearer` antes de entrega-lo a edge function, mesmo com `verify_jwt = false`. Isso faz com que o token extraido nunca bata com `WHATSAPP_INBOUND_SECRET`.

Evidencia nos logs (18:13:02):
- `hasAuth: true` (header existe)
- Mas a comparacao falha (gateway substituiu o valor)
- Resultado: 401

## Solucao

Mover a validacao de `X-Webhook-Signature` (HMAC-SHA256) para **antes** da rejeicao por auth, usando-a como metodo de autenticacao valido. A Mensageria ja envia esse header em todas as requisicoes.

## Mudancas no arquivo `supabase/functions/whatsapp-inbound/index.ts`

### 1. Alterar o fluxo de autenticacao no handler principal (linhas 724-736)

Atualmente:
```text
validateAuth() -> se falha, retorna 401
X-Webhook-Signature -> validacao opcional depois
```

Novo fluxo:
```text
1. Tentar validateAuth() (Bearer, X-API-Key, query param, etc.)
2. Se falhou, tentar X-Webhook-Signature como auth alternativa
3. Se ambos falharam, retorna 401
```

Concretamente, o bloco nas linhas 730-753 sera reestruturado:

```text
const authOk = validateAuth(req, bodySecret);

// Se auth tradicional falhou, tentar HMAC como autenticacao
let hmacValidated = false;
const webhookSignature = req.headers.get('X-Webhook-Signature');
if (!authOk && webhookSignature) {
  const inboundSecret = getOptionalEnv('WHATSAPP_INBOUND_SECRET');
  if (inboundSecret) {
    hmacValidated = await verifyHmacSignature(rawBody, webhookSignature, inboundSecret);
    if (hmacValidated) {
      log.info('Auth via HMAC X-Webhook-Signature');
    }
  }
}

if (!authOk && !hmacValidated) {
  log.error('Acesso nao autorizado');
  return 401;
}

// Se auth OK mas HMAC presente, ainda validar integridade
if (authOk && webhookSignature && !hmacValidated) {
  // validar integridade como antes (opcional)
  ...
}
```

### 2. Nenhuma outra mudanca necessaria

- O payload ja esta mapeado corretamente
- O `connection_name` ja e extraido
- O `verify_jwt = false` ja esta configurado
- O secret ja esta atualizado

## Resumo de impacto

| Item | Mudanca | Risco |
|------|---------|-------|
| Auth via HMAC | Novo metodo de auth primario | Baixo (HMAC e seguro) |
| Auth tradicional | Mantida como fallback | Nenhum |
| Backward compatibility | Total | Nenhum |

## Resultado esperado

A Mensageria envia `Authorization: Bearer` (que o gateway corrompe) + `X-Webhook-Signature` (que chega intacto). O sistema usa o HMAC para autenticar e a requisicao passa.
