

## Correcao: Autenticacao do SGT Webhook (401 Unauthorized)

### Problema Identificado

O SGT esta enviando o token no header `Authorization: Bearer <token>`, porem o Lovable Cloud intercepta e sobrescreve esse header automaticamente com um JWT interno. Por isso, o token do SGT nunca chega na edge function -- todos os logs mostram `hasAuth: false`.

Este e o mesmo problema que ja foi resolvido no webhook do Blue Chat, onde a solucao foi migrar para o header `x-webhook-secret`.

### Solucao

Alterar a edge function `sgt-webhook` para aceitar o token via header `x-webhook-secret` (alem de manter compatibilidade com `Authorization` como fallback).

### Mudancas

**Arquivo: `supabase/functions/sgt-webhook/index.ts`**

1. Atualizar a lista de headers permitidos no CORS para incluir `x-webhook-secret`
2. Alterar a funcao `validateBearerToken` para:
   - Primeiro tentar ler de `x-webhook-secret`
   - Se nao encontrar, tentar `authorization` como fallback
   - Comparar diretamente o valor (sem exigir prefixo `Bearer`)
3. Atualizar o handler principal para passar o header correto

### Configuracao no SGT

Apos a mudanca, o SGT deve enviar o secret assim:

```text
Headers:
  Content-Type: application/json
  x-webhook-secret: <valor_do_secret>
```

Nao usar mais `Authorization: Bearer ...` para este webhook.

### Secao Tecnica

A funcao de validacao sera alterada de:

```text
authHeader = req.headers.get('authorization')
match = authHeader.match(/^Bearer\s+(.+)$/i)
token === secret
```

Para:

```text
webhookSecret = req.headers.get('x-webhook-secret')
  OU fallback: req.headers.get('authorization') (formato Bearer)
token === SGT_WEBHOOK_SECRET
```

Isso alinha com o padrao ja usado no `bluechat-inbound` e evita o conflito com a interceptacao automatica do header Authorization.
