

## Diagnóstico: Mensagens inbound não aparecem na conversa

### Causa Raiz

O webhook `meta-webhook` **recebe** as mensagens corretamente (logs confirmam: "Message saved", id `74038b25-...`). O problema é que a mensagem é salva **sem `contact_id`**, apenas com `lead_id` (formato legado `inbound_98317422_...`).

A UI busca mensagens por duas vias:
1. `lead_id=eq.{legacy_lead_id}` — mas o contato Arthur tem `legacy_lead_id: null`, então a query vai com `lead_id=eq.` (vazio) → retorna 0 resultados
2. `contact_id=eq.{contactId}` — retorna apenas as 3 mensagens OUTBOUND que têm `contact_id` preenchido

As mensagens inbound ficam "órfãs" — têm `lead_id` mas não `contact_id`, e a UI não consegue encontrá-las.

### Solução

**Arquivo**: `supabase/functions/meta-webhook/index.ts`

Na função `handleMessage`, após encontrar o lead via `findLeadByPhone`, buscar o registro correspondente na tabela `contacts` (pelo telefone + empresa) e incluir o `contact_id` no insert da mensagem.

```
1. Após encontrar/criar o lead_contact
2. Buscar contacts.id WHERE telefone matches AND empresa = resolvedEmpresa
3. Incluir contact_id no insert de lead_messages
```

Isso alinha o comportamento com o fluxo de envio manual (que já seta `contact_id`), garantindo que as mensagens inbound apareçam na conversa.

### Deploy

Redeployar `meta-webhook` após a alteração.

