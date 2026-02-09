
# Registrar Mensagens OUTBOUND da Amelia no Blue Chat

## Problema

Quando a Amelia responde via Blue Chat, a resposta e enviada de volta ao Blue Chat (via callback API) mas **nao e salva no banco** como mensagem OUTBOUND em `lead_messages`. Isso acontece porque:

1. `sdr-ia-interpret` detecta `source === 'BLUECHAT'` e pula o envio via `whatsapp-send`
2. `whatsapp-send` e quem normalmente insere a mensagem OUTBOUND em `lead_messages`
3. `bluechat-inbound` envia a resposta ao Blue Chat via `sendResponseToBluechat` mas tambem nao persiste a mensagem

Resultado: so as mensagens INBOUND aparecem na conversa do lead.

## Solucao

Adicionar a persistencia da mensagem OUTBOUND no `bluechat-inbound`, logo apos receber a resposta da IA e antes de enviar ao Blue Chat. Isso garante que toda resposta da Amelia fique registrada no historico.

## Secao Tecnica

### Arquivo modificado

`supabase/functions/bluechat-inbound/index.ts`

### Alteracao

Apos a linha que verifica `if (iaResult?.responseText)` (por volta da linha 831), antes de chamar `sendResponseToBluechat`, inserir um `INSERT` em `lead_messages` com:

```text
lead_id:     leadContact.lead_id
empresa:     leadContact.empresa
canal:       'WHATSAPP'
direcao:     'OUTBOUND'
conteudo:    iaResult.responseText
estado:      'ENVIADO'
template_codigo: 'BLUECHAT_PASSIVE_REPLY'
```

Isso segue o mesmo padrao que `whatsapp-send` usa para registrar mensagens enviadas, garantindo que:
- A conversa apareca completa no LeadDetail (ConversationView)
- O dashboard de Atendimentos mostre `ultima_direcao: 'OUTBOUND'` apos a Amelia responder
- O historico de mensagens do `sdr-ia-interpret` inclua as respostas anteriores da Amelia para manter contexto

### Nenhuma alteracao de schema necessaria

A tabela `lead_messages` ja tem todas as colunas necessarias.
