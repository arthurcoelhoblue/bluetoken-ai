

# Amélia como Atendente Passiva no Blue Chat

## Resumo

Mudar o comportamento da Amélia dentro do Blue Chat: ao invés de ser proativa (usando dados do SGT, cadências, classificações), ela será uma **atendente passiva**. A Amélia só entra em ação quando o Blue Chat **escala uma conversa para o comercial**. Toda a infraestrutura existente (webhook, callback, health check) é mantida.

## O que muda

Hoje o `bluechat-inbound` recebe qualquer mensagem e tenta qualificar o lead usando cadências e SGT. Com a mudança:

1. **Amélia ignora dados do SGT** - não consulta `sgt_events`, não ativa cadências automaticamente
2. **Amélia é passiva** - responde apenas quando recebe mensagens via Blue Chat (escaladas pelo atendimento)
3. **Sem cadência automática** - não busca nem cria `lead_cadence_runs` no fluxo do Blue Chat
4. **Foco em atendimento** - a IA responde como uma consultora comercial conversando, sem o motor de cadências por trás

## Alterações Técnicas

### 1. Modificar `bluechat-inbound/index.ts`

**Remover dependência de cadências no fluxo Blue Chat:**

- Remover a chamada a `findActiveRun()` (linha 649) - não buscar cadência ativa
- Passar `run_id: null` ao salvar mensagem (a mensagem fica vinculada ao lead mas não a uma cadência)
- Remover o registro de `lead_cadence_events` no `saveInboundMessage` (linhas 379-392)
- Continuar chamando `sdr-ia-interpret` mas com flag `source: 'BLUECHAT'` e novo flag `mode: 'PASSIVE_CHAT'`

### 2. Modificar `sdr-ia-interpret/index.ts`

**Adicionar modo passivo (`PASSIVE_CHAT`):**

- Quando `mode === 'PASSIVE_CHAT'`:
  - Usar o conversation state (lead_conversation_state) para manter contexto da conversa
  - **NAO** consultar cadências, SGT events, ou classificação ICP para decidir o tom
  - Manter o framework de qualificacao (SPIN/GPCT) de forma natural na conversa, mas sem forcar
  - Manter deteccao de lead quente (PEDIDO_HUMANO, DECISAO_TOMADA) para escalar quando necessario
  - Prompt diferente: Amelia como atendente comercial consultiva, sem urgencia de cadencia
  - Continuar salvando intents e atualizando conversation state normalmente

### 3. Ajustar o prompt da Amelia para modo passivo

Quando `mode === 'PASSIVE_CHAT'`:
- Amelia se apresenta como consultora do Grupo Blue
- Responde perguntas de forma consultiva
- Qualifica naturalmente durante a conversa (sem seguir script de cadencia)
- Detecta sinais de interesse e escala para humano quando apropriado
- Nao menciona que foi "acionada" ou "escalada"

### 4. Atualizar payload do webhook

Adicionar campo opcional `ticket_id` ao payload do Blue Chat para rastrear o ticket original:

```text
{
  "conversation_id": "bc-conv-123",
  "ticket_id": "ticket-456",        // <-- NOVO: ID do ticket no Blue Chat
  "message_id": "bc-msg-789",
  ...
}
```

O `ticket_id` sera usado nos callbacks (transfer, resolve, close).

## O que NAO muda

- Autenticacao via `BLUECHAT_API_KEY` (ja corrigido)
- Callback de resposta ao Blue Chat (POST /messages)
- Escalacao via ticket transfer quando necessario
- Criacao automatica de lead se nao existir
- Salvamento de mensagens em `lead_messages`
- Health check e tela de configuracao
- Todo o fluxo do SGT e cadencias continua funcionando independentemente

## Fluxo Atualizado

```text
Cliente envia mensagem no WhatsApp
        |
        v
Blue Chat recebe e trata no atendimento geral
        |
        v
Atendente escala para "comercial"
        |
        v
Blue Chat envia webhook --> bluechat-inbound
        |
        v
Busca/cria lead (sem cadencia)
        |
        v
Salva mensagem (run_id = null)
        |
        v
sdr-ia-interpret (mode: PASSIVE_CHAT)
  - Le historico da conversa
  - Responde como consultora
  - Detecta sinais quentes
        |
        v
Callback --> Blue Chat API /messages
        |
        v
Blue Chat entrega resposta ao cliente
```

## Arquivos Modificados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/bluechat-inbound/index.ts` | Remover logica de cadencia, adicionar ticket_id, passar mode PASSIVE_CHAT |
| `supabase/functions/sdr-ia-interpret/index.ts` | Adicionar modo PASSIVE_CHAT com prompt consultivo |
| `docs/patches/PATCH-BLUECHAT_webhook-inbound.md` | Documentar novo comportamento passivo |

