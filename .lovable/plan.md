

# Diagnóstico: WebRTC Não Conecta

## Análise dos Dados

Investiguei a fundo o banco de dados, os logs das edge functions, o código do widget e do hook WebRTC. Aqui está o que encontrei:

### O que funciona
- Edge function `zadarma-proxy` está **deployada e respondendo** (retorna 401 corretamente sem auth)
- Configuração global Zadarma está correta: API keys presentes, `empresas_ativas: [BLUE_LABS, TOKENIZA, BLUE]`, `webrtc_enabled: true`
- Seu ramal 108 existe para BLUE_LABS com `sip_login: 472122-108`

### Problemas encontrados

**1. Sem logs recentes nas edge functions**
Não há nenhum log de `zadarma-proxy` nem `zadarma-webhook` no período recente. Isso significa que o widget não está conseguindo nem fazer a requisição `get_webrtc_key` ao proxy — o problema está no frontend antes de chegar ao backend.

**2. O widget só aparece se `minimized && !number` E `hasExtension` (linha 452-454)**
O hook `useMyExtension` faz a query com o `activeCompany` do contexto. Se o usuário está em uma empresa que não tem ramal configurado, o widget nem renderiza.

**3. Possível problema na inicialização dos scripts Zadarma v9**
O hook `useZadarmaWebRTC` carrega dois scripts externos:
- `https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-lib.js`
- `https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-fn.js`

Se algum desses scripts falhar ao carregar (bloqueio de rede, CORS, ou mudança na URL do Zadarma), a inicialização falha silenciosamente e o status fica em `error`.

**4. Ramal 110 (BLUE_LABS) tem `sip_login: NULL`**
O usuário do ramal 110 na BLUE_LABS nunca vai conseguir usar WebRTC — o `sip_login` está nulo. Precisa ser corrigido para `472122-110`.

**5. Ramal 105 foi completamente removido**
Todas as chamadas históricas (março/2) usaram `internal:105`, mas esse ramal não existe mais na tabela `zadarma_extensions`. Se alguém ainda usa esse ramal, não vai funcionar.

## Plano de Correção

### 1. Corrigir dados no banco
- Atualizar `sip_login` do ramal 110/BLUE_LABS para `472122-110`
- Verificar se ramal 105 precisa ser recriado

### 2. Adicionar logs de diagnóstico ao hook WebRTC
O hook `useZadarmaWebRTC` falha silenciosamente em vários pontos. Adicionar `console.error`/`console.warn` em:
- Falha ao carregar scripts externos
- Falha ao obter WebRTC key
- `zadarmaWidgetFn` não encontrada após timeout
- Status transitions

### 3. Melhorar resiliência do carregamento de scripts
- Adicionar timeout explícito no carregamento dos scripts (30s)
- Se falhar, mostrar erro claro no widget em vez de ficar em "Conectando WebRTC..." eternamente
- Adicionar retry automático (1x) se o script falhar

### 4. Redeployar a edge function `zadarma-proxy`
Garantir que está na versão mais recente com o deploy automático.

