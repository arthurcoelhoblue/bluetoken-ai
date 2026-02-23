

# Correção: Autenticação Blue Chat Inbound

## Problema Identificado

Existem **duas credenciais distintas** na integração com o Blue Chat, mas o sistema está usando a errada para validar chamadas inbound:

| Credencial | Valor | Propósito | Quem usa |
|---|---|---|---|
| **API Key** | `b1f80d0e...` | Chamar a API do Blue Chat (enviar respostas) | Amélia -> Blue Chat (outbound) |
| **Secret** | `JIKLSFhof...` | Blue Chat se autenticar ao chamar nosso webhook | Blue Chat -> Amélia (inbound) |

**O que acontece hoje**: Quando o Blue Chat chama `/bluechat-inbound` com o header `Authorization: Bearer JIKLSFhof...`, o `auth.ts` compara esse token contra `api_key` do `system_settings` (`b1f80d0e...`). Os valores nao batem e retorna **401 Unauthorized**.

Em resumo: o sistema compara a **secret inbound** contra a **API key outbound** -- nunca vai bater.

## Dados atuais no `system_settings` (bluechat_blue)

```json
{
  "api_key": "b1f80d0e778082041ed4245008d2e15c5b12c2acbfb4a7e9ce6314e7535f7132",
  "api_url": "https://chat.grupoblue.com.br/api/external-ai",
  "enabled": true
}
```

Falta o campo `webhook_secret` para validar chamadas inbound.

## Correção

### Passo 1 — Adicionar `webhook_secret` ao `system_settings` da BLUE

Atualizar o JSON value de `bluechat_blue` para incluir a secret de validacao:

```json
{
  "api_key": "b1f80d0e778082041ed4245008d2e15c5b12c2acbfb4a7e9ce6314e7535f7132",
  "api_url": "https://chat.grupoblue.com.br/api/external-ai",
  "webhook_secret": "JIKLSFhofjhalosfSA7W8PR9UFEAUOJIF54702a",
  "enabled": true
}
```

### Passo 2 — Atualizar `_shared/channel-resolver.ts`

Adicionar funcao `resolveBluechatWebhookSecret()` que busca `value->>'webhook_secret'` em vez de `value->>'api_key'`:

```typescript
export async function resolveBluechatWebhookSecret(
  supabase: SupabaseClient,
  empresa: string,
): Promise<string | null> {
  const settingsKey = SETTINGS_KEY_MAP[empresa] || 'bluechat_tokeniza';
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('category', 'integrations')
    .eq('key', settingsKey)
    .maybeSingle();

  const secret = data?.value?.webhook_secret;
  if (secret) return secret;

  // Fallback: env BLUECHAT_API_KEY
  return getOptionalEnv('BLUECHAT_API_KEY') || null;
}
```

### Passo 3 — Atualizar `bluechat-inbound/auth.ts`

`validateAuthAsync` passa a usar `resolveBluechatWebhookSecret()` em vez de `resolveBluechatApiKey()`:

```typescript
import { resolveBluechatWebhookSecret } from "../_shared/channel-resolver.ts";

export async function validateAuthAsync(req, supabase, empresa) {
  // ... extrair token do header (sem mudanca)
  
  // Comparar contra webhook_secret (nao api_key)
  const expectedSecret = await resolveBluechatWebhookSecret(supabase, empresa);
  
  if (expectedSecret && token.trim() === expectedSecret.trim()) {
    return { valid: true };
  }
  // ... fallback env (sem mudanca)
}
```

### Passo 4 — Confirmar que `callback.ts` continua usando `api_key`

O `callback.ts` (envio de respostas para o Blue Chat) ja usa `api_key` corretamente no header `X-API-Key`. Nenhuma mudanca necessaria nesse arquivo.

## Resultado

- Blue Chat envia webhook com `Authorization: Bearer JIKLSFhof...` -> validado contra `webhook_secret` -> **200 OK**
- Amélia responde via callback com `X-API-Key: b1f80d0e...` -> Blue Chat aceita -> **mensagem entregue**
- Separacao clara entre credenciais inbound (webhook_secret) e outbound (api_key)

