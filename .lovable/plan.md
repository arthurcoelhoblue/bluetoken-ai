

## Problema

Quando o lead confirma um horário de reunião (seleciona slot 1, 2 ou 3), o `handleMeetingScheduling` retorna a resposta de confirmação. No `index.ts` (linhas 168-182), o código:

1. Salva a interpretação com `respostaEnviada: true` e o texto da resposta
2. Retorna imediatamente **sem nunca enviar a mensagem via WhatsApp**

Isso explica por que a resposta aparece na UI de interpretações como "enviada" mas o cliente nunca a recebeu.

Compare com o fluxo de `startMeetingScheduling` (linhas 280-298), que corretamente chama `executeActions` para enviar via WhatsApp antes de retornar.

## Correção

### `supabase/functions/sdr-ia-interpret/index.ts` — Adicionar envio WhatsApp no handleMeetingScheduling

Entre o `saveInterpretation` (linha 175) e o `return` (linha 176), adicionar a chamada a `executeActions` — mesmo padrão usado pelo `startMeetingScheduling`:

```ts
// After saveInterpretation, SEND the response via WhatsApp
const telefone = parsedContext.telefone;
if (telefone) {
  await executeActions(supabase, {
    lead_id: msg.lead_id,
    run_id: msg.run_id,
    empresa: msg.empresa,
    acao: 'ENVIAR_RESPOSTA_AUTOMATICA',
    acao_detalhes: { intent: 'AGENDAMENTO_REUNIAO' },
    telefone,
    resposta: meetingResult.response,
    source,
    intent: 'AGENDAMENTO_REUNIAO',
    confidence: 1.0,
    mensagem_original: msg.conteudo,
    conversation_state: parsedContext.conversationState,
    historico: parsedContext.historico,
  });
}
```

Também atualizar o `saveInterpretation` para só marcar `respostaEnviada: true` se `telefone` existir (segurança extra).

| Arquivo | Mudança |
|---------|---------|
| `index.ts` (linhas 168-182) | Adicionar `executeActions` para enviar resposta de confirmação de reunião via WhatsApp |

