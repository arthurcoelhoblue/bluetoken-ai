

## Diagnóstico: "Invalid signature" no meta-webhook

### Problema Identificado

As mensagens da Meta estão sendo rejeitadas com **"Invalid signature"** porque o webhook usa uma única variável de ambiente `META_APP_SECRET` para validar a assinatura HMAC, mas as empresas **Blue** e **Tokeniza** usam **aplicativos Meta diferentes** com `app_secret` distintos.

Fluxo atual:
```text
Meta POST → verifySignature(body, sigHeader)  ← usa META_APP_SECRET (global)
           ↓
         FALHA se o app_secret do app Meta que enviou ≠ META_APP_SECRET
```

Dados encontrados:
- **Blue**: `app_secret = 5714...` (no banco, tabela `whatsapp_connections`)
- **Tokeniza**: sem `app_secret` no banco (depende da env var `META_APP_SECRET`)
- Os logs mostram dezenas de **"Invalid signature"** consecutivos, indicando que mensagens de um dos apps estão sendo rejeitadas

### Solução Proposta

Alterar `verifySignature` para uma abordagem **multi-secret** — tentar validar a assinatura contra todos os `app_secret` conhecidos (env var + banco):

1. **Coletar todos os app_secrets disponíveis**: env var `META_APP_SECRET` + todos os `app_secret` ativos em `whatsapp_connections`
2. **Tentar validar contra cada um**: se qualquer um bater, aceitar a mensagem
3. **Manter fallback**: se nenhum `app_secret` estiver configurado, aceitar (comportamento atual para dev)

```text
Meta POST → verifySignature(body, sigHeader)
           ↓
         Tenta META_APP_SECRET (env var)
         Tenta app_secret da Blue (banco)
         Tenta app_secret da Tokeniza (banco)
           ↓
         Se qualquer um validar → OK
         Se nenhum → 401
```

### Alterações

**Arquivo**: `supabase/functions/meta-webhook/index.ts`

- Refatorar `verifySignature()` para aceitar uma lista de secrets e testar cada um
- Antes da validação, buscar todos os `app_secret` ativos de `whatsapp_connections`
- Criar o service client antes da validação (mover para cima)
- Manter log indicando qual secret validou (para debug)

### Deploy
- Redeployar `meta-webhook` após a alteração

