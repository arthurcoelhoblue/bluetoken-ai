

## Plano: Filtrar conversas por ownership do vendedor

### Contexto
- A página Conversas (`ConversasPage`) e o hook `useAtendimentos` atualmente mostram **todas** as conversas filtradas apenas por empresa
- Não há filtro por vendedor/owner — todos veem tudo
- A propriedade do lead está vinculada via `deals.owner_id` (contacts/lead_contacts não têm owner preenchido)
- Apenas 9/130 deals abertos têm `owner_id` — dados esparsos
- Conceito novo: conversas "abertas" = linked a deal ABERTO; deal GANHO/PERDIDO = conversa encerrada

### Detalhes técnicos

#### 1. Alterar `useAtendimentos` para aceitar `userId` e `isAdmin`
- Receber `userId` e `isAdmin` como parâmetros opcionais
- Quando `isAdmin = false`, filtrar apenas conversas onde:
  - O lead tem um deal ABERTO com `owner_id = userId`
  - OU o `lead_conversation_state.assumido_por = userId` (takeover manual)
- Quando `isAdmin = true`, manter comportamento atual (ver tudo)
- Adicionar join com `contacts` (via `legacy_lead_id`) e `deals` (via `contact_id`) para resolver ownership

#### 2. Filtrar apenas conversas com deal ABERTO
- Após coletar os lead_ids, fazer query em `contacts` → `deals` para verificar se existe deal ABERTO
- Excluir conversas cujo deal é GANHO/PERDIDO (conversa "encerrada")
- Admins também veem apenas conversas com deals abertos (ou sem deal vinculado — para não perder leads novos)

#### 3. Atualizar `ConversasPage` e `Atendimentos`
- Passar `user.id` e `isAdmin` do `useAuth()` para o hook `useAtendimentos`
- Nenhuma mudança visual, apenas filtragem de dados

#### Fluxo de dados (query)
```text
lead_messages (passive) → lead_ids
  ↓
contacts (legacy_lead_id = lead_id) → contact_ids
  ↓
deals (contact_id, status=ABERTO) → owner_ids
  ↓
Se !isAdmin: filtrar lead_ids onde deal.owner_id = userId
  OU lead_conversation_state.assumido_por = userId
```

