
# Configurar Integração com Blue Chat

## Resumo

O Blue Chat atualmente usa `WHATSAPP_INBOUND_SECRET` para autenticação, mas tem seu próprio secret (`BLUECHAT_API_KEY`) já configurado. Além disso, falta uma URL de callback para o Blue Chat receber respostas da Amélia, e a tela de configuração pode ser melhorada para mostrar o status real da integração.

## Alterações

### 1. Corrigir autenticação do `bluechat-inbound`

**Arquivo**: `supabase/functions/bluechat-inbound/index.ts`

A função `validateAuth` (linhas 106-127) usa `WHATSAPP_INBOUND_SECRET`. Precisa ser trocado para `BLUECHAT_API_KEY`, que já existe como secret no projeto.

- Substituir `Deno.env.get('WHATSAPP_INBOUND_SECRET')` por `Deno.env.get('BLUECHAT_API_KEY')`
- Atualizar mensagens de log correspondentes

### 2. Adicionar callback de resposta ao Blue Chat

**Arquivo**: `supabase/functions/bluechat-inbound/index.ts`

Após receber a resposta do `sdr-ia-interpret`, enviar a resposta de volta ao Blue Chat via API, usando uma URL configurável armazenada em `system_settings`.

- Criar função `sendResponseToBluechat` que:
  - Lê a URL da API do Blue Chat de `system_settings` (chave `bluechat.api_url`)
  - Usa `BLUECHAT_API_KEY` para autenticar
  - Envia POST com `conversation_id`, `message_id` e `response.text`
  - Trata erro com log (não bloqueia o fluxo)

### 3. Health check real do Blue Chat

**Arquivo**: `supabase/functions/integration-health-check/index.ts`

A função `checkBlueChat` (linhas 256-263) apenas verifica se o secret existe. Melhorar para:

- Ler a URL da API do Blue Chat de `system_settings`
- Tentar um GET na URL base ou `/health`
- Retornar latência e status real da conexão
- Fallback: se não houver URL configurada, reportar "URL não configurada"

### 4. Tela de configuração no painel

**Arquivo**: `src/components/settings/WhatsAppDetailsTab.tsx` (ou novo componente)

Criar uma seção (ou tab) de configuração do Blue Chat que permita:

- Visualizar e editar a URL da API do Blue Chat (salva em `system_settings` com chave `bluechat.api_url`)
- Visualizar o status da integração (Online/Offline) via health check
- Botão "Testar Conexão"
- Mostrar a URL do webhook (`bluechat-inbound`) que deve ser configurada no lado do Blue Chat

Como já existe a tab "Integrações" com o card `CompanyChannelCard` para Blue Chat, a configuração da URL pode ser adicionada ao dialog de "Configurar" que já existe no `IntegrationsTab`.

## Seção Técnica

### Dados em `system_settings`

Será criado/atualizado um registro:
```
category: 'integrations'
key: 'bluechat'
value: { enabled: true, api_url: 'https://...', callback_path: '/api/webhook/amelia' }
```

### Fluxo corrigido

```text
Blue Chat --[BLUECHAT_API_KEY]--> bluechat-inbound
    |
    v
sdr-ia-interpret(source='BLUECHAT')
    |-- Processa com IA
    |-- NAO envia via whatsapp-send
    |-- Retorna responseText
    |
    v
bluechat-inbound --[BLUECHAT_API_KEY]--> Blue Chat API (callback)
    |
    v
Blue Chat entrega ao cliente
```

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/bluechat-inbound/index.ts` | Auth com BLUECHAT_API_KEY + callback de resposta |
| `supabase/functions/integration-health-check/index.ts` | Health check real com URL do Blue Chat |
| `src/components/settings/IntegrationsTab.tsx` | Dialog de configuração com campo de URL |
| `docs/patches/PATCH-BLUECHAT_webhook-inbound.md` | Atualizar documentação de autenticação |
