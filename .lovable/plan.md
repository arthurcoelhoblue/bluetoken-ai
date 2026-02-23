

# Conectar Tokeniza ao Blue Chat

## Estado Atual

O registro `bluechat_tokeniza` em `system_settings` ja existe com:
```json
{
  "api_key": "31ba6714...09ff",
  "api_url": "https://chat.grupoblue.com.br/api/external-ai",
  "enabled": true
}
```

Falta apenas o campo `webhook_secret` para validar chamadas inbound (exatamente o mesmo problema que a Blue tinha).

## Dados Fornecidos

| Campo | Valor | Uso |
|---|---|---|
| **API Key** (outbound) | `31ba6714...09ff` | Amelia envia respostas para o Blue Chat | Ja configurado |
| **Secret** (inbound) | `JIKLSFhof...abc` | Blue Chat autentica ao chamar nosso webhook | **Falta adicionar** |

## Implementacao

### Passo unico — Adicionar `webhook_secret` ao `system_settings`

Atualizar o JSON value de `bluechat_tokeniza` para:

```json
{
  "api_key": "31ba671475e13c8a0b0715ade7975cbfb578469ba60ca1f6f45ae7f7455709ff",
  "api_url": "https://chat.grupoblue.com.br/api/external-ai",
  "webhook_secret": "JIKLSFhofjhalosfSA7W8PR9UFEAUOJIF54702abc",
  "enabled": true
}
```

Nenhuma mudanca de codigo e necessaria porque:
- `resolveBluechatWebhookSecret()` em `channel-resolver.ts` ja busca `webhook_secret` por empresa
- `validateAuthAsync()` em `auth.ts` ja usa essa funcao
- O `SETTINGS_KEY_MAP` ja mapeia `TOKENIZA` para `bluechat_tokeniza`

Apos o UPDATE, testar com um POST simulado usando a secret da Tokeniza no header para confirmar 200 OK.

