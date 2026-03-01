

# Regra Anti-Limbo: Deal Obrigatório para Toda Conversa

## Contexto

Hoje, o `whatsapp-inbound` cria `lead_contacts` (e via trigger, `contacts`) mas **não cria deals**. Deals só são criados manualmente (vendedor via `CreateDealFromConversationDialog`) ou pela IA quando escala leads quentes (`autoCreateDeal` no `sdr-ia-interpret`). Isso gera "conversas sem deal" no dashboard.

A `lead_contacts` já tem `utm_campaign` e `nome` disponíveis — exatamente o que precisamos para o título do deal.

## Plano

### 1. Auto-criação de deal no `whatsapp-inbound` (backend)

Após salvar a mensagem inbound e ter um `resolvedLeadId` + `empresa`, o webhook vai:

1. Esperar ~500ms para o trigger `fn_sync_lead_to_contact` criar o `contacts` correspondente
2. Buscar o `contacts.id` via `legacy_lead_id`
3. Verificar se já existe deal ABERTO para esse contact
4. Se não existe, criar deal automaticamente:
   - **Pipeline**: default da empresa (`is_default = true`)
   - **Stage**: primeiro estágio aberto (menor `posicao`, `is_won = false`, `is_lost = false`)
   - **Título**: `"Nome do Lead [campanha]"` — usando `lead_contacts.nome` + `lead_contacts.utm_campaign`; se campanha vazia, só o nome; se nome vazio, `"Lead WhatsApp [telefone]"`
   - **Owner**: Round-robin (vendedor com menos deals abertos na empresa), usando a mesma lógica que já existe no `action-executor.ts`
   - **Temperatura**: `FRIO` (inbound inicial)

### 2. Filtro anti-limbo no frontend (`useAtendimentos.ts`)

- **Vendedor (não-admin)**: remover a condição `noDealYet` — só vê conversas com deal onde é owner ou que assumiu
- **Admin**: mantém visibilidade total

### 3. Kanban — remover coluna "Sem deal" (`ConversasKanban.tsx`)

Remover o bloco que cria a coluna `__sem_deal__` (linhas 46-54). Todas as conversas no kanban terão deal.

### 4. Card visual — badge "IA atendendo" (`ConversaCard.tsx`)

Quando `modo !== 'MANUAL'` e é visível para admin, mostrar badge contextual.

### 5. Mobile

Revisar os novos elementos para responsividade (cards, filtros, kanban scroll touch).

## Arquivos a modificar

| Arquivo | Ação |
|---|---|
| `supabase/functions/whatsapp-inbound/index.ts` | Adicionar auto-criação de deal após `saveInboundMessage` com título `"Nome [campanha]"` e round-robin owner |
| `src/hooks/useAtendimentos.ts` | Remover `noDealYet` para não-admins |
| `src/components/conversas/ConversasKanban.tsx` | Remover coluna "Sem deal" |
| `src/components/conversas/ConversaCard.tsx` | Badge "IA atendendo" para contexto admin |

## Detalhes do título do deal

```text
Nome presente + campanha presente → "João Silva [Meta Ads Investidores]"
Nome presente + sem campanha      → "João Silva"
Sem nome + campanha presente      → "Lead WhatsApp [Meta Ads Investidores]"
Sem nome + sem campanha           → "Lead WhatsApp +5511999887766"
```

