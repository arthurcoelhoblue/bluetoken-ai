

# Plano: Ativar WebRTC com sip_login 472122-108

## Problema
Os 3 registros de extensão 108 (BLUE, TOKENIZA, BLUE_LABS) têm `sip_login = null`. Sem ele, o widget opera em modo Callback (que também está falhando silenciosamente).

## Correções

### 1. Atualizar sip_login nas 3 extensões
Executar UPDATE para definir `sip_login = '472122-108'` nos 3 registros do ramal 108.

### 2. Corrigir handleDial (modo Callback) 
O `handleDial` referencia `hasExtension` que é definido **depois** — causando `ReferenceError` silenciosa no `console.warn`. Corrigir para usar `myExtension` diretamente e garantir que erros sejam visíveis.

### 3. Resultado esperado
Com `sip_login` preenchido, o widget muda para modo **WebRTC**: busca a chave via `/v1/webrtc/get_key/`, carrega os scripts Zadarma, e permite chamadas diretas pelo navegador. O badge muda de "Callback" para "WebRTC".

