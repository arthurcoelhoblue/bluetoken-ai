

## Problema

O `startMeetingScheduling` está importado no `index.ts` mas **nunca é chamado**. O fluxo atual:

1. `handleMeetingScheduling` (linha 148) — verifica se já existe um estado `PENDENTE` de agendamento
2. Se não existe estado pendente, retorna `{ handled: false }` e segue o fluxo normal
3. O classificador pode detectar `AGENDAMENTO_REUNIAO` como intent, mas **ninguém inicia o fluxo de slots**

O lead pede reunião, a IA classifica corretamente, mas nunca busca os horários na agenda do vendedor.

## Solução

Adicionar a chamada a `startMeetingScheduling` no `index.ts` quando:
- O `handleMeetingScheduling` retorna `{ handled: false }` (sem estado pendente)
- E o intent classificado é `AGENDAMENTO_REUNIAO`

### Mudança em `supabase/functions/sdr-ia-interpret/index.ts`

Após a classificação de intent (seção 4b, ~linha 251), verificar se o intent é `AGENDAMENTO_REUNIAO` e iniciar o fluxo de agendamento:

```ts
// After classifyIntent, around line 251:
if (classifierResult.intent === 'AGENDAMENTO_REUNIAO' && !meetingResult.handled) {
  const startResult = await startMeetingScheduling(supabase, meetingCtx);
  if (startResult.handled && startResult.response) {
    const intentId = await saveInterpretation(supabase, msg, {
      intent: 'AGENDAMENTO_REUNIAO',
      confidence: classifierResult.confidence,
      acao: 'ENVIAR_RESPOSTA_AUTOMATICA',
      deve_responder: true,
    }, true, true, startResult.response);
    // Send response via WhatsApp
    if (telefone) {
      await executeActions(supabase, {
        lead_id: msg.lead_id, run_id: msg.run_id, empresa: msg.empresa,
        acao: 'ENVIAR_RESPOSTA_AUTOMATICA', telefone,
        resposta: startResult.response, ...
      });
    }
    return json response with slots offered
  }
}
```

O `meetingCtx.ownerId` vem de `parsedContext.deals?.[0].owner_id`. Se o lead não tiver deal com owner, o `startMeetingScheduling` já trata retornando `{ handled: false }`.

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/sdr-ia-interpret/index.ts` | Chamar `startMeetingScheduling` quando intent = `AGENDAMENTO_REUNIAO` e não há estado pendente |

