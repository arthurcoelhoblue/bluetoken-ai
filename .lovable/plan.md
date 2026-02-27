

## Plano: API Key e Connection Name por empresa para Mensageria

### Problema
Hoje o `whatsapp-send` usa uma única `MENSAGERIA_API_KEY` (env global) e `connectionName: 'arthur'` hardcoded. Cada empresa precisa de sua própria API key e nome de conexão.

### Solução
Armazenar `api_key` e `connection_name` na tabela `integration_company_config`, que já tem a relação empresa × canal.

### Alterações

#### 1. Migration: adicionar colunas na `integration_company_config`
- `api_key TEXT` — API key da mensageria para aquela empresa
- `connection_name TEXT` — nome da conexão Baileys (ex: `'arthur'`, `'bluelabs'`)

#### 2. Atualizar edge function `whatsapp-send`
- Em `sendViaMensageria`, receber `apiKey` e `connectionName` como parâmetros
- No handler principal, buscar esses valores de `integration_company_config` onde `empresa = X` e `channel = 'mensageria'`
- Fallback: se `api_key` estiver null na tabela, usar env `MENSAGERIA_API_KEY` (compatibilidade)
- Remover `connectionName: 'arthur'` hardcoded

#### 3. Atualizar UI `CompanyChannelCard`
- Para o canal `mensageria`, mostrar campos editáveis de `api_key` e `connection_name` dentro de cada card de empresa
- Salvar diretamente na `integration_company_config`

#### 4. Seed: popular Blue Labs com dados atuais
- `UPDATE integration_company_config SET connection_name = 'arthur' WHERE empresa = 'BLUE_LABS' AND channel = 'mensageria'`
- A api_key será inserida via UI (campo mascarado)

### Detalhes técnicos

O fluxo no `whatsapp-send` ficará:
```
const { data: channelConfig } = await supabase
  .from('integration_company_config')
  .select('channel, enabled, api_key, connection_name')
  .eq('empresa', empresa)
  .eq('enabled', true)
  .single();

// Para mensageria:
const apiKey = channelConfig.api_key || getOptionalEnv('MENSAGERIA_API_KEY');
const connName = channelConfig.connection_name || 'arthur';
```

A UI terá inputs inline no card de cada empresa quando o canal for `mensageria`, permitindo configurar API key (campo password) e connection name por empresa.

