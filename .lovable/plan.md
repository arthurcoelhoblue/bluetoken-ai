
Objetivo: eliminar de forma definitiva os 2 erros do botão “Abordar via Amélia” no contexto de deal/pipeline, cobrindo tanto o caminho de chat quanto o envio para Blue Chat.

Diagnóstico consolidado (com base nos logs + código atual):
1) Erro 400 “Missing lead_id/contact_id or empresa”
- O request que falha vem do chat do deal (não do ícone do header).
- Evidência de rede: `{"lead_id":"","empresa":"BLUE","motivo":"Acionado manualmente pelo chat","bypass_rate_limit":true}`.
- Causa técnica:
  - `ManualMessageInput` sempre envia `lead_id: leadId` sem normalizar.
  - Em `DealDetailSheet -> ConversationPanel`, quando o contato não tem `legacy_lead_id`, o `leadId` passado é string vazia (`''`).
  - Nesse caminho, `contact_id` não é enviado como fallback.

2) Erro 400 “Validation failed: ticketId Required”
- Evidência nos logs da função: payload enviado para Blue Chat contém `conversation_id`, mas sem `ticketId`.
- Causa técnica:
  - `sdr-proactive-outreach` só inclui `ticketId` se `bluechat_ticket_id` existir no framework_data ou vier da resposta de envio.
  - Para esse lead, `framework_data` possui apenas `bluechat_conversation_id` (sem `bluechat_ticket_id`).
  - A API do Blue Chat exige `ticketId` nesse endpoint.

3) Problema estrutural que pode gerar próximo erro após corrigir ticket
- A função `sdr-proactive-outreach` tenta inserir campos não existentes em `lead_messages` (`metadata`, `source`, `remetente`).
- A tabela atual `lead_messages` não possui essas colunas.
- Se o envio ao Blue Chat passar, a função tende a quebrar em seguida ao registrar mensagem no banco.

Solução definitiva proposta

Escopo de arquivos:
- `src/components/deals/DealDetailSheet.tsx`
- `src/components/conversas/ConversationPanel.tsx`
- `src/components/conversas/ManualMessageInput.tsx`
- `supabase/functions/sdr-proactive-outreach/index.ts`

1) Corrigir origem do payload no chat do deal (frontend)
1.1 Passar `contactId` até o `ManualMessageInput`
- `DealDetailSheet` já tem `deal.contact_id`; repassar para `ConversationPanel`.
- `ConversationPanel` repassa `contactId` para `ManualMessageInput`.

1.2 Normalizar IDs antes de invocar função
- Em `ManualMessageInput`, criar normalização:
  - `normalizedLeadId = leadId?.trim() || undefined`
  - `normalizedContactId = contactId || undefined`
- Montar body com fallback:
  - se `normalizedLeadId` existir, envia `lead_id`
  - senão, envia `contact_id`
- Guard clause:
  - se não houver nem `lead_id` nem `contact_id`, não chamar função; mostrar toast claro (“Contato sem identificador para abordagem automática”).

Resultado esperado:
- Não haverá mais request com `lead_id: ""`.
- O caminho de deal sem legado usará `contact_id` corretamente.

2) Blindar `sdr-proactive-outreach` contra payload incompleto
2.1 Sanitização de entrada no backend
- Normalizar `lead_id`, `contact_id`, `empresa` com `trim`.
- Validar com os valores normalizados (não com string crua).
- Tratar string vazia como ausente.

2.2 Resolver identificador efetivo sem ambiguidade
- Manter fluxo atual:
  - `lead_id` -> busca em `lead_contacts`
  - fallback `contact_id` -> `resolveLeadFromContact`
- Garantir que `resolvedContactId` fique sempre preenchido quando possível.

Resultado esperado:
- Mesmo que frontend mande campos vazios acidentalmente, backend não seguirá com estado inválido.

3) Tornar envio Blue Chat robusto para ticket obrigatório
3.1 Resolver ticket de forma resiliente
- Ler de `framework_data` múltiplas chaves (compatibilidade):
  - `bluechat_ticket_id`, `ticket_id`, `ticketId`
- Resolver `conversationId` também com fallback de chaves.
- Regra de fallback final:
  - se existe `conversationId` e não existe `ticketId`, usar `ticketId = conversationId`.
  - Isso já é padrão em outro fluxo do projeto (`bluechat-inbound/callback.ts`).

3.2 Fortalecer abertura de conversa (quando necessário)
- Se não houver `conversationId` e `ticketId`, abrir conversa.
- Parsing robusto da resposta de `/conversations`:
  - `ticket_id`, `ticketId`, `ticket?.id`
  - `conversation_id`, `conversationId`, `id`, `conversation?.id`
- Após abrir:
  - se ainda faltar ticket mas tiver conversation, usar fallback para `ticketId = conversationId`.

3.3 Envio com payload de contrato completo
- Sempre enviar:
  - `ticketId` (obrigatório)
  - `content`
  - `source`
  - `phone`
  - `type: "TEXT"` (aderente ao protocolo da integração)
- Se não houver ticket após todos os fallbacks, retornar erro interno explícito e não chamar `/messages`.

Resultado esperado:
- Elimina o erro “ticketId Required”.
- Mensagem passa a ser aceita consistentemente.

4) Corrigir persistência no banco após envio
4.1 Ajustar insert em `lead_messages` para schema real
- Substituir insert atual por campos existentes:
  - `lead_id`, `empresa`, `canal`, `direcao`, `conteudo`, `estado`, `template_codigo`, `enviado_em`, `whatsapp_message_id` (quando disponível)
- Remover campos inexistentes (`metadata`, `source`, `remetente`).

4.2 Manter rastreabilidade no local correto
- Persistir `bluechat_conversation_id` e `bluechat_ticket_id` em `lead_conversation_state.framework_data` (já existe no fluxo).
- Isso evita depender de coluna inexistente em `lead_messages`.

Resultado esperado:
- Não haverá “erro em cascata” após o envio ser aceito pela API externa.

5) Critérios de aceite (validação fim a fim)
5.1 Cenário A: deal sem `legacy_lead_id`, com `contact_id`
- Clicar “Abordar via Amélia” no chat do deal.
- Request deve ter `contact_id` (sem `lead_id` vazio).
- Resposta da função: `success: true`.
- Sem runtime error no frontend.

5.2 Cenário B: lead com `conversation_id` salvo e sem `ticket_id`
- Clicar “Abordar via Amélia”.
- Logs da função devem mostrar payload com `ticketId`.
- Mensagem deve aparecer no Blue Chat.
- `lead_conversation_state.framework_data` deve ficar com `bluechat_ticket_id` preenchido.

5.3 Cenário C: primeira abordagem sem conversa prévia
- Função deve abrir conversa e enviar mensagem na sequência.
- Sem erro 400 de ticket.

5.4 Persistência
- `lead_messages` deve registrar outbound com schema válido.
- `whatsapp_message_id` e timestamps preenchidos quando disponíveis.

Ordem de implementação recomendada:
1. Frontend (propagar `contactId` + normalização de payload no `ManualMessageInput`).
2. Backend entrada/sanitização.
3. Backend resolução de `ticketId` e payload Blue Chat.
4. Backend persistência `lead_messages` alinhada ao schema.
5. Testes E2E nos 3 cenários acima com checagem de logs e banco.

Riscos e mitigação:
- Risco: variação no shape da resposta de `/conversations`.
  - Mitigação: parser defensivo com múltiplas chaves e fallback controlado.
- Risco: registros legados sem `ticket_id`.
  - Mitigação: fallback `ticketId = conversationId` + persistência no framework_data.
- Risco: regressão em outros pontos que chamam a função.
  - Mitigação: backend tolerante a strings vazias + validação explícita de identificadores.

Impacto esperado:
- Remove os dois erros reportados pelo usuário.
- Evita regressão por payload incompleto.
- Evita próximo erro oculto de schema em `lead_messages`.
- Estabiliza o fluxo de “Abordar via Amélia” para contatos legados e contatos CRM.
