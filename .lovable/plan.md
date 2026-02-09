
# Painel de Atendimentos Blue Chat

## Resumo

Criar uma nova pagina "Atendimentos Blue Chat" que serve como central de monitoramento das conversas ativas da Amelia no modo atendente passivo. Diferente das cadencias (que tratam de outreach proativo), esta tela mostra as conversas reativas recebidas via Blue Chat.

## O que ja funciona sem mudancas

- **Detalhe do Lead** (`/leads/:id/:empresa`): ja mostra mensagens trocadas, intents, estado de conversa (SPIN/GPCT/DISC) - tudo isso funciona independente de cadencia
- **Leads Quentes** (`/admin/leads-quentes`): ja captura leads escalados pela IA
- **Lista de Leads** (`/leads`): mostra todos os leads, incluindo os criados pelo Blue Chat (origem `BLUECHAT`)

## O que sera criado

### 1. Nova pagina: Atendimentos Blue Chat (`/atendimentos`)

Uma tela dedicada que lista as conversas ativas vindas do Blue Chat, mostrando:

- **Lista de conversas recentes**: leads que receberam mensagens INBOUND via Blue Chat (origem_telefone = 'BLUECHAT' ou mensagens com whatsapp_message_id de prefixo Blue Chat)
- **Status por conversa**: ultima mensagem, tempo desde ultimo contato, se a Amelia ja respondeu, se foi escalado
- **Indicadores visuais**: badge de "Aguardando resposta", "Amelia respondeu", "Escalado para humano"
- **Filtro por empresa**: BLUE / TOKENIZA
- **Ordenacao**: mais recentes primeiro, com destaque para conversas sem resposta

### 2. Dados utilizados (ja existem no banco)

A pagina ira consultar dados que ja sao gravados pelo sistema atual:

- `lead_contacts` com `origem_telefone = 'BLUECHAT'` para identificar leads do Blue Chat
- `lead_messages` com `direcao = 'INBOUND'` e `direcao = 'OUTBOUND'` para ver troca de mensagens
- `lead_message_intents` para ver interpretacoes da IA
- `lead_conversation_state` para ver estado de qualificacao

### 3. Menu de navegacao

Adicionar "Atendimentos" no sidebar, na secao "Principal", visivel para ADMIN e CLOSER.

### 4. Card de atendimento

Cada card mostrara:
- Nome do lead e telefone
- Empresa (BLUE/TOKENIZA)
- Ultima mensagem (preview truncado)
- Tempo desde ultimo contato
- Contagem de mensagens (inbound/outbound)
- Intent detectado mais recente
- Estado do funil (SAUDACAO, QUALIFICACAO, etc)
- Botao para abrir o detalhe do lead

## Secao tecnica

### Hook: `useBlueChartAtendimentos`

```text
Query:
1. Buscar lead_contacts com origem_telefone = 'BLUECHAT'
2. Para cada lead, buscar ultima mensagem de lead_messages
3. Buscar ultimo intent de lead_message_intents
4. Buscar estado de lead_conversation_state
5. Ordenar por ultima mensagem mais recente
```

Alternativa mais eficiente: uma unica query com JOINs:

```text
SELECT 
  lc.lead_id, lc.empresa, lc.nome, lc.telefone, lc.telefone_e164,
  -- Ultima mensagem
  (SELECT conteudo FROM lead_messages lm WHERE lm.lead_id = lc.lead_id ORDER BY created_at DESC LIMIT 1) as ultima_mensagem,
  (SELECT created_at FROM lead_messages lm WHERE lm.lead_id = lc.lead_id ORDER BY created_at DESC LIMIT 1) as ultimo_contato,
  (SELECT direcao FROM lead_messages lm WHERE lm.lead_id = lc.lead_id ORDER BY created_at DESC LIMIT 1) as ultima_direcao,
  -- Contagem
  (SELECT COUNT(*) FROM lead_messages lm WHERE lm.lead_id = lc.lead_id AND lm.direcao = 'INBOUND') as total_inbound,
  (SELECT COUNT(*) FROM lead_messages lm WHERE lm.lead_id = lc.lead_id AND lm.direcao = 'OUTBOUND') as total_outbound,
  -- Estado
  cs.estado_funil, cs.framework_ativo, cs.perfil_disc,
  -- Ultimo intent
  (SELECT intent FROM lead_message_intents lmi WHERE lmi.lead_id = lc.lead_id ORDER BY created_at DESC LIMIT 1) as ultimo_intent
FROM lead_contacts lc
LEFT JOIN lead_conversation_state cs ON cs.lead_id = lc.lead_id AND cs.empresa = lc.empresa
WHERE lc.origem_telefone = 'BLUECHAT'
ORDER BY ultimo_contato DESC NULLS LAST
```

### Componentes criados

| Componente | Descricao |
|------------|-----------|
| `src/pages/Atendimentos.tsx` | Pagina principal com lista de atendimentos |
| `src/hooks/useAtendimentos.ts` | Hook para buscar dados dos atendimentos Blue Chat |

### Arquivos modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/layout/AppSidebar.tsx` | Adicionar link "Atendimentos" na secao Principal |
| `src/App.tsx` | Adicionar rota `/atendimentos` |

### Fluxo do usuario

1. Usuario abre "Atendimentos" no menu lateral
2. Ve lista de conversas ativas do Blue Chat, ordenadas por mais recentes
3. Identifica conversas que precisam de atencao (sem resposta, escaladas)
4. Clica em um lead para ver o detalhe completo (conversa, intents, estado)
5. No detalhe do lead, ve a conversa completa no ConversationView que ja existe
