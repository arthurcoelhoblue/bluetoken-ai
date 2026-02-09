

# Corrigir Duplicidade: Blue Chat vs Mensageria

## Problema Identificado

Quando uma mensagem chega pelo Blue Chat, o fluxo atual e:

1. `bluechat-inbound` recebe a mensagem e chama `sdr-ia-interpret`
2. `sdr-ia-interpret` processa e chama `whatsapp-send` (Mensageria) para enviar a resposta
3. `bluechat-inbound` tambem retorna a resposta de volta ao Blue Chat

Resultado: a resposta e enviada DUAS vezes -- uma pelo Blue Chat e outra pela Mensageria. O `whatsapp-send` ja bloqueia quando `mensageria=false` na `integration_company_config`, mas isso gera erro 403 desnecessario nos logs, e o fluxo nao esta semanticamente correto.

## Solucao

Adicionar um parametro `source` ao `sdr-ia-interpret` para que ele saiba a origem da mensagem e pule o envio via `whatsapp-send` quando a origem for BLUECHAT.

### Alteracoes

**1. `bluechat-inbound/index.ts`** (linha ~420-428)
- Ao chamar `sdr-ia-interpret`, incluir `source: 'BLUECHAT'` no body do request, alem do `messageId`

**2. `sdr-ia-interpret/index.ts`** (2 pontos)
- No handler principal: ler o campo `source` do body da requisicao
- Na secao de envio de resposta automatica (~linha 3915-3957): se `source === 'BLUECHAT'`, pular a chamada a `sendAutoResponse` e apenas registrar o texto da resposta sem enviar. A resposta sera retornada ao `bluechat-inbound` que a entrega ao Blue Chat.

### Fluxo Corrigido

```text
Blue Chat envia mensagem
    |
    v
bluechat-inbound recebe
    |
    v
sdr-ia-interpret(messageId, source='BLUECHAT')
    |-- Processa com IA
    |-- NAO chama whatsapp-send (porque source=BLUECHAT)
    |-- Retorna responseText
    |
    v
bluechat-inbound retorna responseText ao Blue Chat
    |
    v
Blue Chat entrega a resposta ao cliente
```

### O que NAO muda

- Fluxo do `whatsapp-inbound` (mensagens diretas) continua igual
- Verificacao de `integration_company_config` no `whatsapp-send` permanece como segunda camada de seguranca
- Tabela `integration_company_config` e trigger de exclusividade mutua permanecem intactos

## Secao Tecnica

### Arquivo: `supabase/functions/bluechat-inbound/index.ts`
- Funcao `callSdrIaInterpret`: adicionar campo `source: 'BLUECHAT'` ao JSON body enviado ao endpoint `sdr-ia-interpret`

### Arquivo: `supabase/functions/sdr-ia-interpret/index.ts`
- Handler principal (`serve`): extrair `body.source` da requisicao
- Condicional de envio (~linha 3915): adicionar `&& source !== 'BLUECHAT'` para pular `sendAutoResponse`
- Garantir que `respostaTexto` ainda e populado para que o retorno inclua o texto (usado pelo `bluechat-inbound`)
- Incluir log indicando que o envio foi pulado por ser origem BLUECHAT

