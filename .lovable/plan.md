

## Plano: Suportar envio de WhatsApp para contatos sem `legacy_lead_id`

### Problema
O `whatsapp-send` exige `leadId` (campo obrigatório), mas contatos criados diretamente no CRM não possuem `legacy_lead_id`. Isso bloqueia o envio de mensagens para esses contatos.

### Alterações

#### 1. Adicionar coluna `contact_id` na tabela `lead_messages`
- Migration: `ALTER TABLE lead_messages ADD COLUMN contact_id UUID REFERENCES contacts(id)`
- Isso permite registrar mensagens vinculadas a um contato mesmo sem lead legado

#### 2. Atualizar edge function `whatsapp-send`
- Aceitar `contactId` como alternativa a `leadId`
- Validação: exigir **pelo menos um** dos dois (`leadId` ou `contactId`)
- Se `contactId` for fornecido sem `leadId`, buscar `legacy_lead_id` do contato (se existir) para manter compatibilidade
- Gravar `contact_id` em `lead_messages` quando disponível
- Verificar opt-out via `contacts` quando `leadId` não estiver disponível

#### 3. Atualizar `useSendManualMessage` hook
- Adicionar `contactId` opcional ao `SendManualParams`
- Enviar `contactId` no body do invoke quando disponível

#### 4. Atualizar `ManualMessageInput`
- Remover o bloqueio "Lead não vinculado"
- Se `leadId` não existir mas `contactId` existir, usar `contactId` para enviar
- Buscar telefone do contato via `contacts` quando necessário

#### 5. Atualizar `ConversationPanel` e chamadores
- `DealDetailSheet`: passar `contactId` e permitir chat mesmo sem `legacy_lead_id`
- `ContactDetailSheet`: idem

### Detalhes técnicos

A lógica no edge function ficará:
```
if (!leadId && !contactId) → 400 error
if (contactId && !leadId) → buscar legacy_lead_id do contact, usar se existir
```

O `lead_messages.lead_id` continuará preenchido quando disponível, e `contact_id` será gravado em paralelo para rastreabilidade.

