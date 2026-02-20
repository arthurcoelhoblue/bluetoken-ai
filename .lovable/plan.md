
# Verificação automática de conexão Blue Chat + abertura do diálogo em caso de erro

## Contexto atual

As API Keys já estão salvas no banco para TOKENIZA e BLUE. O fluxo atual exige que o admin clique manualmente em "Configurar" no card do Blue Chat. O usuário quer que ao abrir a aba de Canais (Integrações), o sistema já verifique se a conexão está OK e, se não estiver, abra automaticamente o diálogo de configuração.

## O que será feito

### 1. Teste automático de conexão ao montar o componente `IntegrationsTab`

Ao carregar a aba de integrações (quando as `settings` estiverem disponíveis), o componente vai:

- Verificar se existe `api_key` salva no banco para **TOKENIZA** e **BLUE** (lendo `bluechat_tokeniza` e `bluechat_blue` das settings)
- Chamar `checkHealth("bluechat")` para testar a conectividade real com a edge function `integration-health-check`
- Se o health check retornar `offline` ou `error`, abrir automaticamente o `BlueChatConfigDialog`
- Exibir um toast informando o motivo da abertura automática

### 2. Lógica de decisão para abrir o diálogo

O diálogo será aberto automaticamente se qualquer uma dessas condições for verdadeira:
- A `api_key` da TOKENIZA **não** está salva no banco
- A `api_key` da BLUE **não** está salva no banco
- O health check retornar status diferente de `"online"`

Se tudo estiver OK, exibir um toast de sucesso discreto e não abrir o diálogo.

### 3. Estado visual no card do Blue Chat

Adicionar no `CompanyChannelCard` um indicador de status de saúde (badge verde/vermelho) para que o usuário veja visualmente se a conexão está ativa, sem precisar clicar em "Testar".

## Arquivos alterados

### `src/components/settings/IntegrationsTab.tsx`

- Adicionar `useEffect` que roda quando `settings` estiver carregado
- Verificar presença de `api_key` nas settings de bluechat por empresa
- Chamar health check e, se falhar, chamar `setBlueChatDialogOpen(true)` + exibir toast explicativo
- Passar o status do health check para o `CompanyChannelCard` via prop

### `src/components/settings/CompanyChannelCard.tsx`

- Aceitar prop opcional `healthStatus?: HealthCheckResult`
- Exibir badge de status (verde = online, vermelho = offline/erro, cinza = não verificado) ao lado do botão "Configurar"

## Detalhes técnicos

O efeito de verificação automática roda **uma única vez** após o carregamento das settings (usando `useRef` para evitar repetição). O hook `useIntegrationHealth` já é importado em `IntegrationsTab`, portanto não há nova dependência a adicionar.

A lógica é:
```
useEffect para verificar settings carregadas
  → se settings tem bluechat_tokeniza e bluechat_blue com api_key → health check
  → se alguma api_key está faltando → abrir diálogo direto (sem health check)
  → se health check falha → abrir diálogo + toast de aviso
  → se health check OK → toast de sucesso discreto
```

O fluxo não bloqueia o carregamento da página nem exibe loading adicional — é transparente ao usuário.
