

## Tornar botao "Ver completo" e aba Chat acessiveis para contatos sem legacy_lead_id

### Problema

O contato "Arthur Teste" foi criado diretamente pelo formulario rapido, portanto nao possui `legacy_lead_id`. Duas funcionalidades dependem exclusivamente desse campo:

1. **Botao ExternalLink** (ver pagina completa) -- so aparece quando `legacyLeadId && leadEmpresa`
2. **Aba Chat** -- so aparece quando `hasChat = !!legacy_lead_id`

Como o contato nao tem vinculo com o sistema legado, ambos ficam invisiveis.

### Solucao

#### 1. Botao "Ver contato" -- fallback para ContactDetailSheet

Quando nao houver `legacy_lead_id`, o botao deve abrir a ficha do contato em vez de navegar para a pagina de lead legado.

**`src/components/deals/DealDetailHeader.tsx`**:
- Receber nova prop `contactId` (o id do contato no CRM)
- Se `legacyLeadId` existir: manter comportamento atual (navegar para `/leads/...`)
- Se nao existir mas `contactId` existir: abrir link para `/contatos?contact=<id>` ou abrir um `ContactDetailSheet` embutido

**`src/components/deals/DealDetailSheet.tsx`**:
- Passar `contactId={deal.contact_id}` para o `DealDetailHeader`

#### 2. Aba Chat -- permitir iniciar conversa por telefone

Mesmo sem `legacy_lead_id`, se o contato tiver telefone e empresa, e possivel enviar mensagens via Blue Chat (o proxy ja aceita `phone` como alternativa a `conversation_id`).

**`src/components/deals/DealDetailSheet.tsx`**:
- Mudar a logica de `hasChat` para:
  ```
  const hasChat = !!contactBridge?.legacy_lead_id || !!contactBridge?.telefone;
  ```
- Passar o telefone como fallback para o `ConversationPanel` quando nao houver `legacy_lead_id`

**`src/components/conversas/ConversationPanel.tsx`**:
- Verificar se o componente ja suporta funcionar sem `leadId` (apenas com telefone). Se nao, adicionar tratamento para esse caso -- permitindo enviar mensagens novas mesmo sem historico de conversa.

### Arquivos alterados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/deals/DealDetailHeader.tsx` | Adicionar prop `contactId`, fallback do botao ExternalLink para abrir contato |
| `src/components/deals/DealDetailSheet.tsx` | Passar `contactId` ao header, expandir logica de `hasChat` para incluir telefone |
| `src/components/conversas/ConversationPanel.tsx` | Garantir que funciona sem `leadId` quando telefone esta disponivel |

### Comportamento esperado

- **Contato com legacy_lead_id**: tudo continua igual (link para lead, chat com historico)
- **Contato sem legacy_lead_id mas com telefone**: botao abre ficha do contato, aba Chat aparece permitindo iniciar conversa
- **Contato sem legacy_lead_id e sem telefone**: botao abre ficha do contato, aba Chat permanece oculta
