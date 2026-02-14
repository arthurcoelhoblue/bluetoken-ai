
# Realtime Subscriptions (3.1) -- Otimizacao de Custos

## Resumo

Tres problemas de custo identificados nas subscriptions realtime do projeto:

1. **Canal sem filtro** em `useConversationMessages` recebe TODOS os inserts de `lead_messages` globalmente
2. **Gamificacao global** em `AppLayout` cria 2 canais WebSocket para todo usuario logado, mesmo sem usar
3. **Polling agressivo** em `useAtendimentos` consulta 4 tabelas a cada 30 segundos

---

## Fase 1: Remover canal sem filtro (`useConversationMessages.ts`)

O channel `messages-inbound-unmatched` (linhas 169-189) escuta **todos** os INSERTs na tabela `lead_messages` sem nenhum filtro server-side. Cada mensagem enviada/recebida no sistema inteiro dispara este callback para cada conversa aberta.

**Mudanca:** Remover o segundo channel inteiro. A query inicial ja busca mensagens unmatched por telefone, e o channel filtrado por `lead_id` ja cobre mensagens associadas. Para unmatched que chegam depois, o polling natural do React Query (staleTime) resolve.

**Linhas afetadas:** 168-189 (remover) + 193 (remover `supabase.removeChannel(inboundChannel)`)

## Fase 2: Gamificacao lazy (`AppLayout.tsx` + novo provider)

Atualmente `useGamificationNotifications()` e chamado na linha 35 de `AppLayout.tsx`, criando 2 channels WebSocket (`seller_points_log` + `seller_badge_awards`) para **todo usuario logado** em **toda pagina**.

**Mudanca:**
1. Remover `useGamificationNotifications()` de `AppLayout.tsx`
2. Criar `src/hooks/useGamificationRealtimeProvider.tsx` -- um wrapper que ativa as subscriptions apenas quando montado
3. Montar o provider apenas nas paginas que usam gamificacao:
   - `WorkbenchPage.tsx` (ja usa `WorkbenchGamificationCard`)
   - `MetasPage.tsx` (tem aba de gamificacao)

**Resultado:** Channels de gamificacao so existem quando o usuario esta nas 2 paginas relevantes, ao inves de em todas as ~25 paginas.

## Fase 3: Reduzir polling de Atendimentos (`useAtendimentos.ts`)

O `refetchInterval: 30000` dispara 4 queries simultaneas (lead_messages, lead_contacts, lead_conversation_state, lead_message_intents) a cada 30 segundos.

**Mudanca:**
- `refetchInterval: 60000` (60s ao inves de 30s -- reduz queries pela metade)
- Adicionar `refetchOnWindowFocus: true` para refresh imediato quando usuario volta a aba

---

## Arquivos Modificados

| Acao | Arquivo | Mudanca |
|------|---------|---------|
| Editar | `src/hooks/useConversationMessages.ts` | Remover channel `messages-inbound-unmatched` |
| Editar | `src/components/layout/AppLayout.tsx` | Remover `useGamificationNotifications()` |
| Criar | `src/hooks/useGamificationRealtimeProvider.tsx` | Wrapper que monta gamification notifications on-demand |
| Editar | `src/pages/WorkbenchPage.tsx` | Adicionar `useGamificationNotifications()` |
| Editar | `src/pages/MetasPage.tsx` | Adicionar `useGamificationNotifications()` |
| Editar | `src/hooks/useAtendimentos.ts` | `refetchInterval: 60000` + `refetchOnWindowFocus: true` |

## Impacto nos Custos

- **Canal sem filtro removido:** Elimina N broadcasts/segundo para cada conversa aberta (onde N = volume total de mensagens do sistema)
- **Gamificacao lazy:** De 2 channels permanentes por usuario para 2 channels apenas em 2 paginas (~92% de reducao)
- **Polling reduzido:** 50% menos queries de atendimentos por minuto

## Risco

- **Baixo**: Mensagens INBOUND unmatched podem levar ate o proximo refetch para aparecer (em vez de realtime). Isso e aceitavel porque unmatched sao raros e o canal filtrado por lead_id ja cobre o caso principal.
