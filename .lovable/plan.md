

# Patch 3: Conversas, Intervencao do Vendedor, Copilot IA

## Objetivo

Transformar a tela `/conversas` (hoje shell vazio) num painel de atendimento completo com:
1. Lista de conversas com busca, filtros (empresa, status SDR/Manual/Aguardando), badges de modo
2. Intervencao do vendedor (Takeover): toggle SDR <-> Manual com confirmacao, auto-takeover ao enviar mensagem
3. Input de mensagem manual pelo vendedor
4. ConversationPanel: wrapper que combina TakeoverBar + ConversationView + ManualInput + Copilot
5. Copilot IA: sheet lateral com chat contextualizado (Lead, Deal, Pipeline)
6. Auditoria de takeover (quem assumiu/devolveu, quando, motivo)
7. Respeitar modo MANUAL no sdr-ia-interpret (nao gerar resposta automatica)

## O que existe e sera preservado

- `Atendimentos.tsx` -- permanece em `/atendimentos` com redirect
- `ConversationView.tsx` -- reutilizado dentro do novo ConversationPanel
- `ConversationStateCard.tsx` -- permanece no LeadDetail
- Todos os hooks existentes (useAtendimentos, useConversationMessages, useConversationState, useLeadIntents)
- Edge functions: sdr-ia-interpret, bluechat-inbound, whatsapp-inbound/send

---

## Fase 1: Banco de Dados

### Migration SQL

1. **Enum** `atendimento_modo` (`SDR_IA`, `MANUAL`, `HIBRIDO`)
2. **lead_conversation_state** -- novos campos:
   - `modo atendimento_modo NOT NULL DEFAULT 'SDR_IA'`
   - `assumido_por UUID FK -> profiles`
   - `assumido_em TIMESTAMPTZ`
   - `devolvido_em TIMESTAMPTZ`
   - `perfil_investidor TEXT CHECK IN ('CONSERVADOR', 'ARROJADO')`
   - Indices: `idx_lcs_modo`, `idx_lcs_assumido_por`
3. **conversation_takeover_log** (nova tabela):
   - `id, lead_id, empresa, canal, acao CHECK ('ASSUMIR','DEVOLVER'), user_id FK, motivo, created_at`
   - RLS: SELECT para authenticated, INSERT para ADMIN/CLOSER
4. **lead_messages** -- novos campos:
   - `sender_type TEXT NOT NULL DEFAULT 'AMELIA' CHECK IN ('AMELIA','VENDEDOR','SISTEMA')`
   - `sender_id UUID FK -> profiles`
5. **copilot_messages** (nova tabela):
   - `id, user_id FK, context_type, context_id, empresa, role, content, model_used, tokens_input, tokens_output, latency_ms, created_at`
   - RLS: users leem/inserem apenas seus proprios registros

---

## Fase 2: Types e Hooks

### `src/types/conversas.ts` (novo)
- `AtendimentoModo`, `SenderType`, `TakeoverAcao`
- `ConversationModeState`, `TakeoverLogEntry`
- `CopilotContextType`, `CopilotMessage`
- `AtendimentoEnhanced` (estende Atendimento com modo, assumido_por, tempo_sem_resposta)
- `SendManualMessagePayload`

### `src/hooks/useConversationMode.ts` (novo)
- `useConversationTakeover()` -- mutations para ASSUMIR e DEVOLVER
  - Atualiza `lead_conversation_state.modo` + insere `conversation_takeover_log`
- `useSendManualMessage()` -- envia via `whatsapp-send`, marca `sender_type=VENDEDOR`
  - Auto-takeover se modo != MANUAL

### `src/hooks/useAtendimentos.ts` (atualizar)
- Incluir campos `modo`, `assumido_por` e `assumido_por_nome` do `lead_conversation_state` na query
- Calcular `tempo_sem_resposta_min` e `sla_estourado`

---

## Fase 3: Componentes de Conversas

### `src/components/conversas/ConversationTakeoverBar.tsx` (novo)
- Barra no topo do chat mostrando modo atual (SDR_IA vs MANUAL)
- Botao "Assumir atendimento" / "Devolver a Amelia"
- AlertDialog de confirmacao antes de cada acao
- Badge visual: verde para SDR_IA, azul para MANUAL

### `src/components/conversas/ManualMessageInput.tsx` (novo)
- Textarea com auto-resize + botao enviar
- Placeholder muda conforme modo ("Digite sua mensagem..." vs "Enviar e assumir atendimento...")
- Enter envia, Shift+Enter quebra linha
- Se telefone nao disponivel, mostra aviso
- Auto-takeover com toast ao enviar em modo SDR_IA

### `src/components/conversas/ConversationPanel.tsx` (novo)
- Wrapper que combina: TakeoverBar + ConversationView + ManualInput
- Botao Copilot no header
- Recebe props de messages, conversationState, classificacao
- Substitui a renderizacao direta de ConversationView no LeadDetail

### `src/components/copilot/CopilotPanel.tsx` (novo)
- Sheet lateral (420-480px)
- Chat com Amelia Copilot
- Recebe contexto: lead, empresa, estado funil, framework, classificacao, ultimas mensagens
- Sugestoes rapidas contextuais (por tipo: LEAD, PIPELINE, GERAL)
- Chama edge function `copilot-chat` (se nao existir, mostra mensagem de demonstracao)
- Persiste em `copilot_messages`
- 3 variantes de trigger: icon, button, fab

---

## Fase 4: Pagina ConversasPage

### `src/pages/ConversasPage.tsx` (reescrever)
- Header com titulo, stats (total, aguardando, manual)
- Busca por nome/telefone/lead_id
- Filtros: empresa (Todas/Blue/Tokeniza), status (Todos/Aguardando/Respondido/Vendedor)
- Lista de cards clicaveis que navegam para `/leads/:leadId/:empresa`
- Cada card mostra: avatar com icone de modo, nome, empresa, badge de status, preview da ultima mensagem, tempo sem resposta, contadores inbound/outbound, estado funil

---

## Fase 5: Integracao no LeadDetail

### `src/pages/LeadDetail.tsx` (modificar)
- Substituir `<ConversationView>` por `<ConversationPanel>` no main content
- Passar props: messages, conversationState, classificacao, leadId, empresa, telefone
- ConversationStateCard permanece abaixo (mostra SPIN/GPCT/DISC)

---

## Fase 6: Edge Function sdr-ia-interpret

### Modificacao critica
- No inicio do processamento, apos buscar `lead_conversation_state`, verificar campo `modo`
- Se `modo = 'MANUAL'`: registrar intent normalmente (para historico), mas NAO gerar resposta automatica e NAO enviar mensagem
- Se `modo = 'SDR_IA'` ou `'HIBRIDO'`: funcionar normalmente

---

## Fase 7: Rotas e Navegacao

### `src/App.tsx`
- Rota `/conversas` aponta para novo `ConversasPage` (roles: ADMIN, CLOSER)
- Rota `/atendimentos` redireciona para `/conversas` (retrocompatibilidade)

### `src/components/layout/AppSidebar.tsx`
- Item "Conversas" ja existe apontando para `/conversas`
- Remover item "Atendimentos" se existir separado (a rota de redirect cobre)

### Copilot FAB global (opcional)
- Adicionar `<CopilotPanel variant="fab" />` no `AppLayout.tsx` para acesso de qualquer pagina

---

## Fase 8: Edge Function copilot-chat (futura)

O documento indica que a edge function `copilot-chat` sera criada em patch futuro. Neste patch, o CopilotPanel tentara chamar `copilot-chat` e, se falhar, mostrara mensagem de demonstracao. Porem, podemos ja criar uma versao basica que usa o Lovable AI Gateway.

---

## Resumo de arquivos

### Novos
1. `src/types/conversas.ts`
2. `src/hooks/useConversationMode.ts`
3. `src/components/conversas/ConversationTakeoverBar.tsx`
4. `src/components/conversas/ManualMessageInput.tsx`
5. `src/components/conversas/ConversationPanel.tsx`
6. `src/components/copilot/CopilotPanel.tsx`
7. `supabase/functions/copilot-chat/index.ts` (versao basica)

### Modificados
1. `src/hooks/useAtendimentos.ts` -- incluir modo/assumido_por
2. `src/pages/ConversasPage.tsx` -- reescrever de shell para pagina completa
3. `src/pages/LeadDetail.tsx` -- ConversationView -> ConversationPanel
4. `src/App.tsx` -- redirect /atendimentos -> /conversas
5. `src/components/layout/AppLayout.tsx` -- CopilotPanel FAB
6. `supabase/functions/sdr-ia-interpret/index.ts` -- check modo MANUAL

### Migration SQL
1. Enum + campos + tabelas conforme Fase 1

