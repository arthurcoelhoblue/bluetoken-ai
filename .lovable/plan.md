

# Unificar navegacao Lead/Deal e vincular Conversas a Deals

## Problema atual

1. **DealDetailSheet (lateral do Pipeline)** abre ao clicar num card no Kanban, mas nao tem link para a pagina completa do lead (`/leads/:leadId/:empresa`) que mostra conversas, classificacao IA, cadencias, intents, etc.
2. **Conversas** existem associadas a leads via `legacy_lead_id`, mas nao ha vinculo obrigatorio com um deal no funil.
3. **Iniciar conversa** manualmente nao exige criacao/selecao de deal, o que permite conversas "orfas" sem rastreabilidade no pipeline.

## Solucao em 3 partes

### Parte 1 — Botao "Ver pagina completa" no DealDetailSheet

No `DealDetailHeader.tsx`, adicionar um botao/link que navega para `/leads/:legacyLeadId/:empresa`. Para isso:

- O `DealFullDetail` ja tem `contact_id`. Precisamos resolver o `legacy_lead_id` e `empresa` do contato.
- Criar um mini-hook ou query inline em `DealDetailSheet` que busca `legacy_lead_id` e `empresa` do contact via `contact_id`.
- Renderizar um botao "Ver Lead Completo" (com icone ExternalLink) que faz `navigate(/leads/${legacyLeadId}/${empresa})` e fecha o sheet.
- Se o contato nao tiver `legacy_lead_id`, o botao nao aparece.

**Arquivos a modificar:**
- `src/components/deals/DealDetailSheet.tsx` — adicionar query para resolver legacy_lead_id + passar ao header
- `src/components/deals/DealDetailHeader.tsx` — renderizar botao "Ver Lead Completo"

### Parte 2 — Aba "Conversa" no DealDetailSheet

Adicionar uma aba de conversa direto no DealDetailSheet para que o vendedor veja o historico de mensagens sem sair da lateral.

- Reutilizar `ConversationPanel` (ja usado no `ContactDetailSheet` e `LeadDetail`).
- Alimentar com dados do `useConversationMessages` via `legacy_lead_id` resolvido na Parte 1.
- Nova aba "Chat" nas tabs do DealDetailSheet (alem de Timeline, Dados, Campos, IA).

**Arquivos a modificar:**
- `src/components/deals/DealDetailSheet.tsx` — nova TabsTrigger/TabsContent com ConversationPanel

### Parte 3 — Obrigar deal ao iniciar conversa manual

Quando o vendedor envia a primeira mensagem manual (via `ManualMessageInput`), se nao existir deal vinculado aquele lead, abrir um dialog pedindo:
1. Selecao do Pipeline
2. Selecao do Estagio
3. (Opcional) Titulo e valor do deal

O deal e criado automaticamente antes de enviar a mensagem.

**Logica:**
- Verificar se ja existe deal aberto para o `contact_id` resolvido a partir do `lead_id`.
- Se nao existir, abrir `CreateDealFromConversationDialog` antes de prosseguir com o envio.
- Apos criar o deal, enviar a mensagem normalmente.

**Arquivos a criar:**
- `src/components/conversas/CreateDealFromConversationDialog.tsx` — dialog com selecao de pipeline/estagio e criacao do deal

**Arquivos a modificar:**
- `src/components/conversas/ManualMessageInput.tsx` — interceptar envio, checar se deal existe, abrir dialog se necessario
- `src/components/conversas/ConversationPanel.tsx` — passar `contactEmail` e `dealId` derivados para o novo fluxo

## Detalhes tecnicos

### Query para resolver legacy_lead_id no DealDetailSheet

```typescript
const { data: contactBridge } = useQuery({
  queryKey: ['deal-contact-bridge', deal?.contact_id],
  enabled: !!deal?.contact_id,
  queryFn: async () => {
    const { data } = await supabase
      .from('contacts')
      .select('legacy_lead_id, empresa, telefone')
      .eq('id', deal!.contact_id)
      .maybeSingle();
    return data;
  },
});
```

### Verificacao de deal existente para lead

```typescript
const { data: existingDeals } = useQuery({
  queryKey: ['lead-has-deal', contactId],
  enabled: !!contactId,
  queryFn: async () => {
    const { data } = await supabase
      .from('deals')
      .select('id')
      .eq('contact_id', contactId!)
      .eq('status', 'ABERTO')
      .limit(1);
    return data ?? [];
  },
});
```

Se `existingDeals.length === 0`, abrir dialog de criacao antes de enviar mensagem.

### CreateDealFromConversationDialog

Componente com:
- `usePipelines()` para listar pipelines da empresa ativa
- Selector de pipeline -> carrega stages
- Selector de stage
- Campo titulo (pre-preenchido com nome do lead)
- Campo valor (opcional)
- Botao "Criar Deal e Enviar Mensagem"

Apos criacao do deal, chama o callback `onDealCreated(dealId)` e entao executa o envio da mensagem.

### Estrutura de tabs atualizada no DealDetailSheet

```text
Timeline | Dados | Chat | Campos | IA
```

A aba "Chat" so aparece se o contato tiver `legacy_lead_id` (ou seja, tem historico de conversa).

## Resumo de arquivos

| Arquivo | Acao |
|---|---|
| `src/components/deals/DealDetailSheet.tsx` | Resolver contactBridge, aba Chat, passar link ao header |
| `src/components/deals/DealDetailHeader.tsx` | Botao "Ver Lead Completo" com navegacao |
| `src/components/conversas/CreateDealFromConversationDialog.tsx` | Novo dialog para criar deal ao iniciar conversa |
| `src/components/conversas/ManualMessageInput.tsx` | Interceptar envio, checar deal, abrir dialog |
| `src/components/conversas/ConversationPanel.tsx` | Propagar props para o novo fluxo |

Nenhuma migracao de banco necessaria — toda a logica usa tabelas e relacoes existentes (`deals`, `contacts`, `pipelines`, `pipeline_stages`).

