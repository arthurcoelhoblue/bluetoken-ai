

# Diagnóstico: API aceitou mas chamada não conectou

## O que aconteceu
A API Zadarma retornou `status: success` — ela aceitou o pedido de callback. O fluxo do callback Zadarma funciona assim:

1. Zadarma liga para o ramal `from` (108) via SIP
2. Quando o ramal atende, Zadarma conecta ao número `to`

O problema: **o ramal 108 não está registrado em nenhum cliente SIP/WebRTC**. O campo `sip_login` está `null` para todas as 3 extensões do Arthur. Sem um cliente SIP conectado, o Zadarma tenta ligar para o ramal 108 mas não encontra ninguém online.

## O que precisa ser feito

### 1. Configurar `sip_login` no banco
O `sip_login` é o identificador SIP do Zadarma (ex: `123456-108`). Precisa ser preenchido com o valor correto do painel Zadarma.

### 2. Implementar WebRTC no widget (futuro)
Para chamadas direto do navegador, o widget precisa:
- Obter a chave WebRTC via `/v1/webrtc/get_key/` (já existe no proxy)
- Inicializar uma sessão WebRTC com a lib Zadarma
- Registrar o ramal SIP no navegador

Sem isso, o widget é apenas um atalho para o callback — que precisa de um softphone externo (como Zoiper ou o app Zadarma) logado no ramal 108.

### 3. Ação imediata: feedback correto no UI
Atualmente o widget mostra "Discando..." e um timer como se a chamada estivesse ativa. Na realidade, ele só enviou o pedido de callback. Devemos:
- Mudar o texto para "Callback solicitado — atenda seu ramal"
- Não iniciar o timer até receber confirmação via webhook de que a chamada foi atendida

### Resumo das opções
- **Curto prazo**: Instalar um softphone externo (Zoiper/app Zadarma) no ramal 108 e preencher o `sip_login`. O widget funciona como botão de callback.
- **Médio prazo**: Implementar WebRTC nativo no widget para chamadas direto do navegador.

