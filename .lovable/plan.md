

## Diagnóstico — Três Problemas

### Problema 1: E-mail do lead não incluído como convidado na reunião

O `meeting-scheduler.ts` chama `calendar-book` **sem passar `attendee_email`** (linha 159-167). O `calendar-book` suporta o campo `attendee_email` e já adiciona como convidado no Google Calendar quando presente — mas nunca recebe esse dado do scheduler.

O e-mail do lead está disponível em `lead_contacts.email` (ou `pessoas.email_principal`), mas o `MeetingSchedulerContext` não inclui esse campo.

**Correção**:
- Adicionar `leadEmail?: string` ao `MeetingSchedulerContext`
- No `index.ts`, resolver o email do contato: `(parsedContext.contato as any)?.email || pessoaContext?.pessoa?.email_principal`
- No `handleSlotSelection`, passar `attendee_email: ctx.leadEmail` no body do fetch para `calendar-book`

### Problema 2: Horário errado — lead pediu 9h mas agendou 10h

O `calendar-slots` gera slots com base na disponibilidade do vendedor e oferece opções pré-definidas. O lead **não pode pedir um horário específico** — só pode escolher entre 1, 2 ou 3 slots oferecidos. Se o slot das 9h não foi oferecido ou o lead escolheu outro, o sistema agenda o que foi selecionado.

Porém, há um bug maior: o `calendar-slots` usa `new Date()` do servidor (UTC) para construir os horários, mas aplica `setHours()` localmente — sem conversão de timezone. O servidor Deno roda em **UTC**, então `setHours(9, 0)` cria 09:00 UTC = 06:00 BRT. Os labels mostram "09:00" mas o ISO datetime enviado é na verdade 09:00 UTC (= 06:00 BRT ou 10:00 CET dependendo do contexto).

A raiz do problema: **todo o cálculo de slots ignora o timezone do vendedor**. O campo `timezone` existe em `user_meeting_config` mas nunca é usado na geração de slots.

### Problema 3: Timezone por vendedor (Europa vs Brasil)

O campo `user_meeting_config.timezone` já existe (default `America/Sao_Paulo`). A solução é usá-lo tanto na geração de slots quanto na criação de eventos:

- **`calendar-slots`**: Usar o timezone do config para converter corretamente as horas de disponibilidade para UTC antes de comparar com busy periods e gerar ISOs corretos
- **`calendar-book`**: Usar o timezone do vendedor (buscar de `user_meeting_config`) em vez de hardcoded `America/Sao_Paulo`

Para você (Europa), basta configurar `timezone: "Europe/Lisbon"` (ou o fuso correto) no `user_meeting_config`. Para os outros vendedores, o default `America/Sao_Paulo` já funciona.

---

## Plano de Implementação

### 1. `meeting-scheduler.ts` — Passar e-mail do lead como convidado

- Adicionar `leadEmail?: string` à interface `MeetingSchedulerContext`
- Em `handleSlotSelection`, incluir `attendee_email: ctx.leadEmail` no body enviado ao `calendar-book`

### 2. `index.ts` — Resolver e-mail do lead no contexto

- Ao montar `meetingCtx`, adicionar: `leadEmail: contato?.email || pessoaContext?.pessoa?.email_principal`

### 3. `calendar-slots/index.ts` — Corrigir cálculo de timezone

- Ler `config.timezone` (default `America/Sao_Paulo`)
- Construir datas de disponibilidade no timezone correto usando offset manual (Deno não tem Intl timezone nativo para Date, mas podemos calcular offsets conhecidos)
- Garantir que os ISOs gerados representem corretamente o horário no fuso do vendedor
- Labels exibidos ao lead devem refletir o horário de Brasília (já que leads são brasileiros)

### 4. `calendar-book/index.ts` — Usar timezone do vendedor

- Buscar `user_meeting_config.timezone` do owner
- Usar esse timezone no `start.timeZone` e `end.timeZone` do evento Google Calendar (em vez de hardcoded `America/Sao_Paulo`)

### Resumo

| Arquivo | Mudança |
|---------|---------|
| `meeting-scheduler.ts` | Adicionar `leadEmail` ao contexto + passar `attendee_email` no booking |
| `index.ts` | Resolver email do contato para `meetingCtx.leadEmail` |
| `calendar-slots/index.ts` | Usar timezone do vendedor para gerar slots corretos |
| `calendar-book/index.ts` | Buscar timezone do vendedor em vez de hardcoded `America/Sao_Paulo` |

