

# Implementação WebRTC Nativo via Widget Zadarma

## Contexto
O Zadarma fornece um widget WebRTC oficial (scripts JS externos) que encapsula toda a complexidade SIP/WebRTC. A abordagem mais confiável é carregar esse widget e integrá-lo ao nosso phone widget, em vez de reimplementar SIP.js do zero.

## Pré-requisito
O campo `sip_login` dos ramais precisa estar preenchido no banco. Sem ele, o widget WebRTC não consegue se registrar.

## Arquitetura

```text
ZadarmaPhoneWidget (nosso UI)
  │
  ├── useZadarmaWebRTC (novo hook)
  │     ├── Busca WebRTC key via proxy (/v1/webrtc/get_key/)
  │     ├── Carrega scripts Zadarma dinamicamente
  │     └── Inicializa zadarmaWidgetFn(key, sipLogin, ...)
  │
  ├── Modo WebRTC (sip_login preenchido)
  │     └── Usa widget Zadarma para chamadas diretas no browser
  │
  └── Modo Callback (fallback, sem sip_login)
        └── Mantém fluxo atual via /v1/request/callback/
```

## Implementação

### 1. Novo hook `src/hooks/useZadarmaWebRTC.ts`
- Recebe `empresa`, `sipLogin` como parâmetros
- Chama proxy com `action: 'get_webrtc_key'` + `sip_login` ao montar
- Armazena key em state (renovação a cada 70h, key dura 72h)
- Carrega scripts Zadarma via `document.createElement('script')`:
  - `https://my.zadarma.com/webphoneWebRTCWidget/v8/js/loader-phone-lib.js`
  - `https://my.zadarma.com/webphoneWebRTCWidget/v8/js/loader-phone-fn.js`
- Inicializa `zadarmaWidgetFn(key, sipLogin, 'square', 'pt', false, ...)` com `false` para esconder a UI padrão do Zadarma (usamos a nossa)
- Expõe funções: `dial(number)`, `hangup()`, `isReady`

### 2. Atualizar `ZadarmaPhoneWidget.tsx`
- Importar `useZadarmaWebRTC`
- Se `myExtension.sip_login` existe: usar modo WebRTC (dial direto via widget Zadarma)
- Se não tem `sip_login`: manter modo callback atual como fallback
- No `handleDial`: se WebRTC pronto, chamar via widget Zadarma; senão, callback
- Mostrar indicador visual "WebRTC" ou "Callback" no header

### 3. Configuração no Zadarma
O domínio do CRM precisa estar cadastrado em **Settings > Integrations and API > WebRTC widget integration** no painel Zadarma. Sem isso, o widget será bloqueado por CORS.

## Detalhe Técnico
O widget Zadarma expõe a função global `zadarmaWidgetFn()` que cria um iframe SIP no DOM. Passando o 5o parâmetro como `false`, o widget fica invisível (hidden mode). Chamadas são controladas programaticamente via eventos DOM customizados do widget (`zadarmaWidgetEvent`).

## Limitações
- O domínio precisa ser HTTPS e estar registrado no painel Zadarma
- `sip_login` precisa ser preenchido manualmente (ex: `123456-108`)
- A key WebRTC expira em 72h, o hook renova automaticamente

