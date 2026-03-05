

## Diagnóstico — Dois Problemas

### Problema 1: Amélia continua respondendo após "Assumir atendimento"

O clique em "Assumir" define `modo = 'MANUAL'` no `lead_conversation_state`. O SDR verifica isso na **linha 170** de `index.ts`. Porém, o **check de agendamento de reunião** (linha 151) roda **ANTES** do check de modo manual. Se existe um fluxo de agendamento pendente (`meeting_scheduling_state` com status `PENDENTE`), a Amélia responde e retorna **sem nunca verificar se o modo é MANUAL**.

**Correção em `index.ts`**: Mover o check de modo manual para **antes** do check de meeting scheduling. Se `isManualMode`, não executar meeting scheduling nem responder.

```
// ANTES (bug):
1. Meeting scheduling check → responde e retorna
2. Manual mode check ← nunca é alcançado

// DEPOIS (fix):
1. Manual mode check → suprime se MANUAL
2. Meeting scheduling check
```

### Problema 2: Agendamento falha com "Failed to fetch slots" (400)

Os logs mostram que o `ownerId` agora é corretamente resolvido (`3eb15a6a`). Porém `calendar-slots` retorna **400** porque:

- `user_availability` está **vazia** para esse vendedor (Arthur)
- `user_meeting_config` também está **vazia**
- O Google token **existe** mas está **expirado** (expiry: `2026-03-04`)

A linha 31 do `calendar-slots`: `if (availability.length === 0) return json({ error: "Nenhuma disponibilidade configurada" }, 400);`

**Sem disponibilidade configurada, não há como gerar slots.**

**Correção em `calendar-slots/index.ts`**: Adicionar **disponibilidade padrão** como fallback quando `user_availability` está vazia — segunda a sexta, 9h–18h. Assim o agendamento funciona mesmo sem configuração manual.

**Correção em `meeting-scheduler.ts`**: Logar o body do erro retornado pelo `calendar-slots` para visibilidade.

### Resumo de mudanças

| Arquivo | Mudança |
|---------|---------|
| `index.ts` | Mover check de `isManualMode` para ANTES do meeting scheduling (linha ~135) |
| `calendar-slots/index.ts` | Fallback de disponibilidade padrão (seg–sex 09:00–18:00) quando `user_availability` está vazia |
| `meeting-scheduler.ts` | Logar body do erro quando `calendar-slots` retorna não-ok |

