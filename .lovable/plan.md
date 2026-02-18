

# Reverter para API Key por Empresa no Blue Chat

## Problema
O Blue Chat exige uma API key diferente para cada empresa. Atualmente o sistema usa um unico secret `BLUECHAT_API_KEY` para todas, o que causa erro 401 quando a key nao corresponde a empresa.

## Solucao
Armazenar a `api_key` dentro do JSON de cada `system_settings` (por empresa), e resolver dinamicamente em vez de usar um unico env secret.

Exemplo do formato no `system_settings`:
```json
{
  "api_url": "https://chat.grupoblue.com.br/api/external-ai",
  "api_key": "chave-especifica-da-empresa",
  "frontend_url": "...",
  "enabled": true
}
```

---

## Arquivos a modificar

### 1. `supabase/functions/_shared/channel-resolver.ts`
- Na funcao `resolveChannelConfig`, em vez de `getOptionalEnv('BLUECHAT_API_KEY')`, ler `api_key` do JSON do `system_settings` da empresa
- Fallback: se nao encontrar no settings, tentar o env `BLUECHAT_API_KEY` como fallback

### 2. `supabase/functions/bluechat-inbound/auth.ts`
- O webhook de entrada precisa validar a key. Como o payload contem `context.empresa`, extrair a empresa do body e buscar a api_key correspondente no `system_settings`
- Isso requer mudar a assinatura para receber o supabase client e a empresa
- Fallback: manter `BLUECHAT_API_KEY` env como validacao generica

### 3. `supabase/functions/bluechat-inbound/callback.ts`
- Em vez de `getOptionalEnv('BLUECHAT_API_KEY')`, buscar a `api_key` do settings da empresa

### 4. `supabase/functions/bluechat-proxy/index.ts`
- Na funcao `resolveBlueChat`, ler `api_key` do JSON do settings em vez do env

### 5. `supabase/functions/sdr-proactive-outreach/index.ts`
- Na funcao `resolveBlueChat`, ler `api_key` do JSON do settings

### 6. `supabase/functions/whatsapp-send/index.ts`
- Buscar `api_key` do settings da empresa em vez do env

### 7. `supabase/functions/integration-health-check/index.ts`
- Ajustar para buscar key do settings

### 8. `src/components/settings/BlueChatConfigDialog.tsx`
- Adicionar campo de input para "API Key" em cada aba de empresa
- Salvar o valor no JSON do `system_settings` (campo `api_key`)
- Mostrar campo com tipo password para seguranca

---

## Logica central (helper compartilhado)

Criar uma funcao helper em `_shared/channel-resolver.ts`:

```typescript
async function resolveBluechatApiKey(
  supabase: SupabaseClient,
  empresa: string
): Promise<string | null> {
  // 1. Buscar do system_settings da empresa
  const settingsKey = SETTINGS_KEY_MAP[empresa];
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('category', 'integrations')
    .eq('key', settingsKey)
    .maybeSingle();

  const apiKey = (data?.value as any)?.api_key;
  if (apiKey) return apiKey;

  // 2. Fallback para env (compatibilidade)
  return getOptionalEnv('BLUECHAT_API_KEY') || null;
}
```

---

## Fluxo de configuracao pelo usuario

1. Ir em Configuracoes > Blue Chat
2. Em cada aba (Tokeniza, Blue, MPuppe, Axia), preencher a API Key especifica
3. Salvar -- a key fica armazenada no `system_settings` junto com a `api_url`

---

## Ordem de execucao

1. Atualizar o frontend (`BlueChatConfigDialog`) para aceitar API key por empresa
2. Atualizar os edge functions para buscar a key do settings por empresa
3. Deploy das edge functions
4. Configurar as API keys pelo painel
5. Testar envio de mensagem

