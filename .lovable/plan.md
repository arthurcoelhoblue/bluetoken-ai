

# Duas Conexoes Blue Chat Separadas (Tokeniza + Blue)

## Resumo

O Blue Chat opera com instancias 100% separadas por empresa. Atualmente o sistema usa um unico secret `BLUECHAT_API_KEY` e uma unica `api_url`. Precisamos ter configuracoes independentes para cada empresa, com API keys e URLs separadas.

## O que muda para o usuario

- Na tela de Configuracoes > Canais, o card do Blue Chat mostrara campos separados para Tokeniza e Blue
- Cada empresa tera sua propria API key e URL de API
- A autenticacao do webhook aceitara ambas as chaves
- As respostas serao enviadas para a instancia correta do Blue Chat com base na empresa do payload

## Secao Tecnica

### 1. Novo secret para a Blue

Adicionar o secret `BLUECHAT_API_KEY_BLUE` para a instancia Blue. O secret existente `BLUECHAT_API_KEY` passa a ser exclusivo da Tokeniza.

### 2. Alteracoes na edge function `bluechat-inbound/index.ts`

**Autenticacao (`validateAuth`):**
- Aceitar tanto `BLUECHAT_API_KEY` quanto `BLUECHAT_API_KEY_BLUE`
- Retornar qual empresa corresponde a chave usada (permite inferir empresa pelo token)

**Callback (`sendResponseToBluechat`):**
- Receber `empresa` como parametro
- Buscar `api_url` especifico da empresa em `system_settings` (chave `bluechat_tokeniza` ou `bluechat_blue`)
- Usar o secret correto: `BLUECHAT_API_KEY` para Tokeniza, `BLUECHAT_API_KEY_BLUE` para Blue

**Determinacao da empresa:**
- Priorizar `payload.context.empresa`
- Fallback: inferir pela API key usada na autenticacao

### 3. Alteracoes em `system_settings`

Migrar de uma unica entrada `bluechat` para duas entradas:

| category | key | value |
|----------|-----|-------|
| integrations | bluechat_tokeniza | `{ "api_url": "https://chat.grupoblue.com.br/api/external-ai", "enabled": true }` |
| integrations | bluechat_blue | `{ "api_url": "<url_da_instancia_blue>", "enabled": true }` |

A entrada antiga `bluechat` sera mantida por compatibilidade mas nao sera mais usada.

### 4. Alteracoes no frontend

**`BlueChatConfigDialog.tsx`:**
- Transformar em um dialog com duas secoes (ou abas): Tokeniza e Blue
- Cada secao tem seu proprio campo de API URL
- Cada secao mostra o webhook URL (mesmo endpoint, diferenciado pela API key)
- Botao de teste separado por empresa

**`CompanyChannelCard.tsx`:**
- Ao clicar em "Configurar" no Blue Chat, abrir o dialog com a aba da empresa correspondente

### 5. Arquivos modificados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/bluechat-inbound/index.ts` | Autenticacao multi-key, callback por empresa |
| `src/components/settings/BlueChatConfigDialog.tsx` | Campos separados por empresa |
| `src/types/settings.ts` | Atualizar secrets do bluechat |

### 6. Secret a ser adicionado

- `BLUECHAT_API_KEY_BLUE` com valor `218b47edaeeb3dbd786a2d316b6476bdfad47081285c4ed02c0649d0664c04e3`

