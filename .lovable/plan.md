

## Solucao Definitiva: Alinhamento com a API Real do Blue Chat

### Descoberta Critica (leitura do codigo-fonte do Blue Chat)

Ao ler o arquivo `external-ai.routes.ts` do repositorio Blue Chat, ficou claro:

1. **`POST /api/external-ai/messages`** valida com Zod: `ticketId: z.string().min(1)` -- campo OBRIGATORIO, sem excecao
2. **NAO EXISTE endpoint `POST /tickets` nem `POST /conversations`** nas rotas external-ai -- por isso recebemos 404 em todas as tentativas anteriores
3. **Tickets sao criados INTERNAMENTE** pelo Blue Chat quando um cliente envia mensagem, ou pelo `campaign-dispatch.routes.ts` que usa Prisma diretamente (acesso direto ao banco)
4. **O `whatsapp-send` que funciona** envia usando `conversation_id` (NAO `ticketId`) para o endpoint `/messages` com `source: 'MANUAL_SELLER'`

### O Que Funciona Hoje (whatsapp-send, linhas 119-130)

```text
POST /api/external-ai/messages
{
  conversation_id: conversationId,   <-- usa conversation_id
  content: mensagem,
  source: 'MANUAL_SELLER'            <-- source diferente
}
```

Importante: o `whatsapp-send` NAO envia `ticketId`. Envia apenas `conversation_id`. E quando nao tem `conversation_id`, simplesmente retorna erro dizendo que o lead precisa ter uma conversa ativa.

### O Que o sdr-proactive-outreach Faz de Errado

1. Tenta criar ticket via `POST /tickets` -- endpoint inexistente (404)
2. Envia `ticketId` como campo obrigatorio no payload -- mas o Zod do Blue Chat so exige `ticketId` como obrigatorio na validacao, enquanto o fluxo que funciona usa `conversation_id`
3. Para leads novos SEM conversa previa, tenta criar ticket -- impossivel pela API externa

### Solucao em 2 Partes

#### Parte 1: Para leads COM conversa existente (maioria dos casos)

Replicar exatamente o padrao do `whatsapp-send`:
- Usar `conversation_id` do `framework_data`
- Se existe `conversation_id`, enviar: `{ conversation_id, content, source: 'AMELIA_SDR' }`
- O Blue Chat internamente resolve o ticket a partir do `conversation_id`

#### Parte 2: Para leads SEM conversa previa (abordagem fria)

NAO e possivel criar ticket pela API external-ai. A solucao e usar o endpoint `POST /api/campaign-dispatch/campaign-dispatched` que JA EXISTE no Blue Chat e cria tickets + envia mensagens. Este e o unico caminho para outbound proativo.

Payload do campaign-dispatch:
```text
POST /api/campaign-dispatch/campaign-dispatched
{
  event: "campaign.dispatched",
  dispatchedAt: "2026-02-23T...",
  campaignId: 99999,
  campaignName: "Amelia SDR Outreach",
  company: "Blue Consult",    // nome da empresa no Blue Chat
  message: "Oi Arthur, tudo bem?...",
  contacts: [{ name: "Arthur", phone: "5561998317422" }]
}
```

Este endpoint:
- Cria o contato se nao existir
- Cria ticket no departamento Comercial
- Cria a mensagem automaticamente
- Retorna `{ ok: true, ticketsCreated: 1 }`

### Mudancas no Arquivo

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/sdr-proactive-outreach/index.ts` | Refatorar envio Blue Chat com 2 caminhos |

### Detalhamento Tecnico

#### Fluxo Decisorio

```text
1. Resolver lead, gerar mensagem IA (sem mudanca)
2. Verificar se existe conversation_id em framework_data
   |
   |- SIM: Enviar via POST /messages { conversation_id, content, source: 'AMELIA_SDR' }
   |        (mesmo padrao do whatsapp-send que funciona)
   |
   |- NAO: Enviar via POST /campaign-dispatch/campaign-dispatched
   |        { event, campaignId, company, message, contacts }
   |        Isso cria ticket + mensagem automaticamente
   |
3. Registrar em lead_messages + atualizar conversation_state
```

#### Mapeamento empresa para company name (campaign-dispatch)

O endpoint `campaign-dispatch` busca a empresa por nome (`contains`, case insensitive):
- `BLUE` -> `"Blue Consult"` (ou o nome cadastrado no Blue Chat)
- `TOKENIZA` -> `"Tokeniza"`
- `MPUPPE` -> `"MPuppe"`
- `AXIA` -> `"Axia"`

#### Autenticacao do campaign-dispatch

O endpoint usa `CHAT_WEBHOOK_SECRET` como Bearer token (opcional se nao configurado no Blue Chat). Precisamos verificar se este secret esta configurado.

#### Remocao de codigo morto

- Remover toda a logica de `POST /tickets` (endpoint inexistente)
- Remover fallbacks complexos de ticketId
- Simplificar para os 2 caminhos claros acima

### Resultado Esperado

- Leads com conversa existente: envio funciona igual ao `whatsapp-send` (padrao comprovado)
- Leads sem conversa: envio via campaign-dispatch cria ticket e mensagem automaticamente
- Sem mais erros 404 (nao tenta endpoints inexistentes)
- Sem mais erros de `ticketId Required` (usa `conversation_id` quando disponivel)

