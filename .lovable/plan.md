

# Diagnóstico: Botão "Ligar" não funciona + WebRTC

## Dois problemas identificados

### Problema 1: Botão "Ligar" não responde (Callback mode)
O `handleDial` está sendo chamado mas `proxy.mutate()` falha silenciosamente. Não há `try/catch` ao redor da chamada, então se o mutate falhar antes de chegar à rede (ex: erro de serialização, auth expirada), nenhum toast aparece. A correção é:

- Envolver todo o bloco `handleDial` em `try/catch`
- Adicionar `toast.info('Iniciando chamada...')` **antes** de chamar `proxy.mutate` para feedback imediato
- Adicionar `onSettled` no mutate para capturar qualquer estado final
- Adicionar `console.log` no início da função para confirmar execução

### Problema 2: WebRTC não ativo (falta `sip_login`)
O ramal 108 tem `sip_login = null`. Sem ele, o sistema opera em modo Callback. Para ativar WebRTC nativo no navegador (como a documentação Zadarma descreve no "Passo 1 - Cópia da chave"):

- O `sip_login` precisa ser preenchido no banco (formato: `XXXXXX-108` onde XXXXXX é o ID da conta Zadarma)
- Com `sip_login` preenchido, o hook `useZadarmaWebRTC` automaticamente busca a chave via `/v1/webrtc/get_key/`, carrega os scripts do widget Zadarma e inicializa o softphone

## Correções planejadas

### 1. Corrigir handleDial com feedback robusto
No `ZadarmaPhoneWidget.tsx`, adicionar try/catch, toast imediato, e logging no início da função para garantir que qualquer erro seja visível.

### 2. Preencher sip_login do ramal 108
Executar UPDATE no banco para definir o `sip_login` do ramal — **preciso que você me informe o login SIP do ramal 108** (encontra-se no painel Zadarma em Centralita > Extensões, formato tipo `123456-108`).

## Detalhes técnicos

O fluxo WebRTC completo (conforme documentação Zadarma) já está implementado no código:
1. `useZadarmaWebRTC` chama edge function `zadarma-proxy` com action `get_webrtc_key` → proxy chama `/v1/webrtc/get_key/` com o `sip_login`
2. Carrega scripts `loader-phone-lib.js` e `loader-phone-fn.js` do Zadarma
3. Inicializa `zadarmaWidgetFn(key, sipLogin, ...)` em modo invisível
4. Renova a chave a cada 70h (chave expira em 72h)

O código está correto — só falta o dado `sip_login` no banco para ativar o fluxo.

