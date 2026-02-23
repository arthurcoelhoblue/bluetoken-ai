

# Corrigir autenticacao inbound do Blue Chat (x-webhook-signature)

## Problema

As mensagens do Arthur (e de todos os leads) estao chegando ao `bluechat-inbound`, mas sao rejeitadas com 401 porque o Blue Chat autentica via `x-webhook-signature` (HMAC SHA256 do body), e o nosso `auth.ts` so aceita `Authorization: Bearer` ou `X-API-Key`.

Evidencia dos logs:
- 4+ requests rejeitados entre 20:07:32 e 20:07:45
- Todos com `x-webhook-signature: 1e572ebd2dbd56eff133b68ea1d1cd697fb37701a7bca2a263f91e02f7242541`
- Todos com `hasAuth: false, hasApiKey: false`

## Correcao

### Arquivo: `supabase/functions/bluechat-inbound/auth.ts`

Alterar `validateAuth` (sync) para aceitar `x-webhook-signature` como metodo valido de autenticacao. Quando presente, marcar como "pendente validacao HMAC" e deixar passar para o `validateAuthAsync`.

Alterar `validateAuthAsync` para:
1. Se houver `x-webhook-signature`, ler o body do request clonado
2. Calcular HMAC-SHA256 do body usando o `webhook_secret` da empresa (de `system_settings`) ou fallback para env `BLUECHAT_API_KEY`
3. Comparar o hash calculado com o `x-webhook-signature` recebido
4. Se bater, autenticar com sucesso

### Arquivo: `supabase/functions/bluechat-inbound/index.ts`

Alterar a chamada de autenticacao para passar o body raw ao `validateAuthAsync` (necessario para calcular HMAC). O request ja e clonado na linha 56 (`const clonedReq = req.clone()`), entao basta usar esse clone para extrair o body raw.

## Mudancas especificas

### auth.ts - validateAuth (sync)

```typescript
export function validateAuth(req: Request): { valid: boolean } {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');
  const webhookSignature = req.headers.get('x-webhook-signature');
  const token = authHeader ? authHeader.replace('Bearer ', '') : apiKeyHeader;

  if (!token && !webhookSignature) {
    log.warn('Nenhum token recebido na requisição Blue Chat');
    return { valid: false };
  }

  return { valid: true };
}
```

### auth.ts - validateAuthAsync

Adicionar logica HMAC:

```typescript
export async function validateAuthAsync(
  req: Request,
  supabase: SupabaseClient,
  empresa: string,
): Promise<{ valid: boolean }> {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');
  const webhookSignature = req.headers.get('x-webhook-signature');
  const token = authHeader ? authHeader.replace('Bearer ', '') : apiKeyHeader;

  // Metodo 1: Token direto (Authorization/X-API-Key)
  if (token) {
    const expectedSecret = await resolveBluechatWebhookSecret(supabase, empresa);
    if (expectedSecret && token.trim() === expectedSecret.trim()) {
      return { valid: true };
    }
    const envKey = getOptionalEnv('BLUECHAT_API_KEY');
    if (envKey && token.trim() === envKey.trim()) {
      return { valid: true };
    }
  }

  // Metodo 2: HMAC signature (x-webhook-signature)
  if (webhookSignature) {
    const bodyText = await req.text();
    const secret = await resolveBluechatWebhookSecret(supabase, empresa)
      || getOptionalEnv('BLUECHAT_API_KEY');

    if (secret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw', encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(bodyText));
      const computed = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      if (computed === webhookSignature) {
        log.info('Autenticação HMAC validada com sucesso', { empresa });
        return { valid: true };
      }
      log.warn('HMAC signature não confere', { empresa });
    }
  }

  // Nenhum metodo valido
  if (token) {
    log.warn('Token inválido para Blue Chat', { empresa });
  }
  return { valid: false };
}
```

### index.ts - Passar body raw para validateAuthAsync

O `clonedReq` (linha 56) ja existe. O problema e que na linha 59, o body do `req` original ja foi consumido com `req.json()`. Para o HMAC, precisamos do body raw. Solucao: clonar o request uma segunda vez antes de consumir o body, ou ler o body como text primeiro e depois parsear.

Abordagem mais limpa: ler body como text, parsear como JSON, e passar o text raw para auth:

```typescript
// Linha 56-59 alterado:
const bodyText = await req.text();
let rawPayload: unknown;
try {
  rawPayload = JSON.parse(bodyText);
} catch {
  return new Response(
    JSON.stringify({ error: 'Invalid JSON' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

E na chamada de `validateAuthAsync`, passar `bodyText` como parametro adicional.

## Resultado esperado

Apos o deploy, os webhooks do Blue Chat serao autenticados via HMAC signature e as mensagens do Arthur (e de todos os leads) serao processadas normalmente pela Amelia.

## Arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/bluechat-inbound/auth.ts` | Aceitar `x-webhook-signature` no sync e validar HMAC no async |
| `supabase/functions/bluechat-inbound/index.ts` | Ler body como text para disponibilizar ao HMAC, ajustar chamada de auth |

