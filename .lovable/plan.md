

## Duas Correções no Agendamento de Reuniões

### Problema 1: Título genérico "Reunião com lead"

Em `meeting-scheduler.ts` linha 165, o título é hardcoded como `"Reunião com lead"`. O padrão desejado é: **"Reunião {Empresa} - {Nome do Lead}"**.

Para resolver, o scheduler precisa de dois dados adicionais no contexto:
- **Nome do lead** (já disponível em `parsedContext.leadNome`)
- **Nome da organização** (disponível via `contacts.organization_id → organizations.nome`, mas atualmente NÃO carregado)

**Mudanças:**

| Arquivo | O que muda |
|---------|-----------|
| `meeting-scheduler.ts` | Adicionar `leadNome?: string` e `empresaNome?: string` ao `MeetingSchedulerContext`. Usar para construir o título `"Reunião {empresaNome} - {leadNome}"` no booking request (linha 165), com fallback para "Reunião" se dados estiverem ausentes |
| `message-parser.ts` | Na query de `contacts` (linha 258-260), expandir o select para incluir `organization_id` e fazer um join ou fetch subsequente para buscar `organizations.nome`. Retornar como `contactsOrgName` no `ParsedContext` |
| `index.ts` | Passar `leadNome` e `empresaNome` (da org) no `meetingCtx` |

### Problema 2: E-mail do lead não incluído no convite

O `leadEmail` já é resolvido no `index.ts` (linhas 150-153) e passado ao `meetingCtx`. Porém:

1. A query de `lead_contacts` (message-parser.ts linha 239) **não seleciona o campo `email`** — falta adicioná-lo ao select
2. A query de `contacts` CRM (linha 258-260) também não busca email

Além disso, quando o lead não tem email cadastrado, a Amélia deve **pedir o email** antes de confirmar o agendamento.

**Mudanças:**

| Arquivo | O que muda |
|---------|-----------|
| `message-parser.ts` (linha 239) | Adicionar `email` ao select de `lead_contacts` |
| `message-parser.ts` (linha 259) | Adicionar `email` ao select de `contacts` |
| `meeting-scheduler.ts` | Em `handleSlotSelection`, antes de confirmar o booking: se `ctx.leadEmail` estiver vazio, **não agendar** — em vez disso, salvar o slot escolhido no state e pedir o email ao lead. Adicionar um novo status intermediário `AGUARDANDO_EMAIL` no flow |
| `meeting-scheduler.ts` | Quando o lead responde com email (detectar via regex de email), completar o booking com o email fornecido |
| `meeting-scheduling-state` | Pode precisar de um campo `slot_pre_selecionado` para guardar o slot enquanto aguarda o email |

### Fluxo atualizado do agendamento (quando não há email)

```text
Lead: "quero agendar"
Amélia: "Tenho esses horários: 1️⃣ ... 2️⃣ ... 3️⃣ ..."
Lead: "1"
Amélia: "Preciso do seu e-mail para enviar o convite da reunião. Pode me informar?"
Lead: "joao@empresa.com"
Amélia: "Perfeito! Reunião agendada para ... ✅ Link: ..."
```

### Resumo de arquivos alterados

| Arquivo | Mudanças |
|---------|----------|
| `message-parser.ts` | Adicionar `email` ao select de `lead_contacts` + buscar `organizations.nome` via `contacts.organization_id` |
| `meeting-scheduler.ts` | Título dinâmico "Reunião {Org} - {Lead}" + fluxo de pedir email quando ausente (status `AGUARDANDO_EMAIL`) |
| `index.ts` | Passar `leadNome` e `empresaNome` no `meetingCtx` |

