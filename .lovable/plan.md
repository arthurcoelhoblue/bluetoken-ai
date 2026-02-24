
Objetivo: eliminar o loop de erro no “Abordar via Amélia” e separar claramente o que conseguimos resolver do nosso lado versus o que depende de implementação no Blue Chat.

1) Diagnóstico consolidado (com evidências)

- Erro atual no nosso backend:
  - `Cannot POST /api/external-ai/conversations`
  - Origem: `sdr-proactive-outreach` tenta abrir conversa nova em `POST {baseUrl}/conversations`.
- Configuração atual da integração:
  - `system_settings.integrations.bluechat_*` aponta `api_url = https://chat.grupoblue.com.br/api/external-ai`.
- Leitura do repositório Blue Chat (`apps/api/src/routes/external-ai.routes.ts`):
  - Existe `POST /messages` (com `ticketId` obrigatório).
  - Não existe `POST /conversations` nessa API externa.
- Leitura do servidor Blue Chat (`apps/api/src/server.ts`):
  - `campaign-dispatch` está montado em `app.use('/api/webhooks', campaignDispatchRouter)`.
  - Portanto o caminho correto é `/api/webhooks/campaign-dispatched` (não `/api/campaign-dispatch/...`).
- Leitura de `campaign-dispatch.routes.ts`:
  - Endpoint cria contato/ticket/mensagem no banco.
  - Não chama serviço de envio WhatsApp nessa rota.
  - Ou seja: pode registrar despacho, mas não garante envio real da mensagem para o cliente.

Conclusão técnica:
- O erro repetido não é bug “pontual”, é incompatibilidade de contrato:
  - Nosso fluxo B usa endpoint inexistente (`/conversations`) na API `external-ai`.
  - E a rota alternativa testada também estava em path incorreto.
- Para cold outreach real (lead sem ticket ativo), hoje não há endpoint “external-ai” explícito para “criar ticket + enviar WhatsApp”.

2) Plano do nosso lado (imediato, para parar o loop)

2.1. Estabilizar `sdr-proactive-outreach` (fail-safe e sem tentativa inválida)
- Arquivo: `supabase/functions/sdr-proactive-outreach/index.ts`
- Mudanças:
  - Remover tentativa de `POST /conversations` no Path B.
  - Não tentar mais caminhos já comprovadamente inválidos.
  - Para Path A (quando já existe conversa/ticket):
    - Enviar em `/messages` com payload compatível: priorizar `ticketId` (e manter fallback compatível se necessário).
    - Log estruturado com `lead_id`, `ticketId/conversation_id`, status HTTP e corpo resumido.
  - Para Path B (sem ticket/conversa):
    - Retornar erro funcional claro e orientativo (não genérico), por exemplo:
      - “Este lead ainda não possui ticket ativo no Blue Chat. O Blue Chat precisa disponibilizar endpoint de abertura proativa para envio inicial.”
    - Incluir `integration_required: true` no JSON para o frontend tratar melhor.
- Resultado imediato:
  - Acaba o ciclo de 404 repetitivo.
  - Usuário passa a receber causa real em vez de stack genérica.

2.2. Alinhar função auxiliar que também está com contrato inválido
- Arquivo: `supabase/functions/bluechat-proxy/index.ts`
- Mudanças:
  - Remover/neutralizar action `open-conversation` (hoje chama endpoint inexistente).
  - Deixar erro explícito para não incentivar uso de rota inválida no futuro.
- Resultado:
  - Evita regressão por outro fluxo que tente “abrir conversa” via endpoint inexistente.

2.3. Melhorar feedback no frontend (sem “erro técnico cru”)
- Arquivos:
  - `src/components/deals/DealDetailHeader.tsx`
  - `src/components/conversas/ManualMessageInput.tsx`
- Mudanças:
  - Se `integration_required: true`, mostrar toast orientativo:
    - “Para primeiro contato, o Blue Chat ainda precisa habilitar endpoint de abertura proativa. Para leads com conversa ativa, a Amélia funciona normalmente.”
- Resultado:
  - Menos fricção operacional do time comercial.

3) Plano do lado Blue Chat (necessário para viabilizar cold outreach de verdade)

Solicitação de implementação para o time Blue Chat:

3.1. Novo endpoint externo para abordagem proativa
- Proposta mínima:
  - `POST /api/external-ai/proactive-message`
- Autenticação:
  - mesmo padrão de `external-ai` (`X-API-Key` por empresa).
- Body:
  - `phone`, `contact_name`, `content`, `source`, `department` (opcional).
- Comportamento:
  - localizar/criar contato
  - abrir ticket (se não houver aberto)
  - enviar mensagem via conexão WhatsApp ativa
  - retornar `ticketId`, `conversationId`, `messageId`, `status`.
- Benefício:
  - resolve o caso crítico “lead sem conversa prévia”.

3.2. Alternativa menor (se preferirem evoluir endpoint existente)
- Permitir em `POST /api/external-ai/messages`:
  - enviar por `phone` quando `ticketId` não for informado,
  - com auto-criação de ticket.
- Também precisa retornar IDs criados.

3.3. Critérios de aceite para Blue Chat
- Requisição com número novo envia mensagem real para WhatsApp.
- Ticket aparece no painel no departamento esperado.
- API retorna IDs para rastreabilidade.
- Erros de conexão/departamento retornam 4xx sem HTML genérico.

4) Sequência de execução recomendada

Fase 1 (rápida, nossa):
1. Refatorar `sdr-proactive-outreach` para parar tentativas inválidas.
2. Ajustar `bluechat-proxy` (`open-conversation`).
3. Melhorar mensagens de erro no frontend.
4. Validar e2e no `/pipeline` com:
   - lead com ticket ativo (deve enviar)
   - lead sem ticket ativo (deve orientar, sem 404 técnico)

Fase 2 (dependência externa):
5. Enviar especificação para Blue Chat (endpoint proativo).
6. Após entrega deles, adaptar Path B para novo endpoint e validar novamente e2e.

5) Riscos e mitigação

- Risco: “parece regressão” no cold outreach (porque hoje falha com 404 e passará a falhar com erro funcional claro).
  - Mitigação: comunicação explícita + mensagem amigável no frontend.
- Risco: Blue Chat implementar endpoint com contrato diferente.
  - Mitigação: fechar contrato (payload/response/status) antes da entrega.
- Risco: diferenças entre branches/ambientes do Blue Chat.
  - Mitigação: teste contratual em ambiente de produção real com 2 números (um com ticket, outro sem ticket).

6) Entregáveis do plano

- Código (nosso lado):
  - `supabase/functions/sdr-proactive-outreach/index.ts`
  - `supabase/functions/bluechat-proxy/index.ts`
  - `src/components/deals/DealDetailHeader.tsx`
  - `src/components/conversas/ManualMessageInput.tsx`
- Documento curto de handoff para Blue Chat:
  - problema, evidência, contrato de endpoint proativo, critérios de aceite.

Resumo executivo:
- O bug recorrente não é “mais uma tentativa de URL”, é ausência de endpoint compatível para primeiro disparo na API external-ai atual.
- Do nosso lado, a correção certa agora é estabilizar (sem rota inválida) e dar erro funcional claro.
- Para viabilizar abordagem proativa real em leads sem conversa, precisamos de implementação no Blue Chat.
