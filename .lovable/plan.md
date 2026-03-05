

## Correção: Título da reunião deve usar o nome da empresa do CRM (tenant), não a organização do cliente

### Problema
O `empresaNome` no contexto da reunião está sendo preenchido com `contactsOrgName` — o nome da organização do **cliente**. O correto é usar o nome da empresa **do CRM** (tenant): Blue Consult, Blue Labs, Tokeniza, etc.

### Solução

**`meeting-scheduler.ts`** — Atualizar `buildMeetingTitle` para usar `ctx.empresa` (o tenant) mapeado para o nome legível, em vez de `ctx.empresaNome`:

```ts
const EMPRESA_DISPLAY: Record<string, string> = {
  BLUE: "Blue Consult",
  BLUE_LABS: "Blue Labs",
  TOKENIZA: "Tokeniza",
  MPUPPE: "MPuppe",
  AXIA: "Axia",
};

function buildMeetingTitle(ctx: MeetingSchedulerContext): string {
  const empresaDisplay = EMPRESA_DISPLAY[ctx.empresa] || ctx.empresa;
  const parts: string[] = ["Reunião", empresaDisplay];
  if (ctx.leadNome) {
    parts.push("-");
    parts.push(ctx.leadNome);
  }
  return parts.join(" ");
}
```

Resultado: `"Reunião Blue Consult - João Silva"`

**`index.ts`** — Remover o campo `empresaNome` do `meetingCtx` (não é mais necessário, pois `empresa` já está no contexto).

| Arquivo | Mudança |
|---------|---------|
| `meeting-scheduler.ts` | Mapa de display names + `buildMeetingTitle` usa `ctx.empresa` |
| `index.ts` | Remover `empresaNome` do meetingCtx |

