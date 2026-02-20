
# Estado atual da integração Blue Chat vs. o que o novo modelo exige

## O que já está construído (e funciona)

A integração com o Blue Chat já é substancialmente mais avançada do que parece. Veja o que existe:

### Modo passivo (inbound) — COMPLETO
A `bluechat-inbound` já recebe mensagens do Blue Chat via webhook, resolve o lead pelo telefone, cria leads/deals automaticamente, chama a Amélia (SDR IA Interpret), e devolve a resposta de volta ao Blue Chat via callback API. Escalação e resolução de ticket também estão implementadas.

### Modo ativo (outbound SDR) — PARCIALMENTE COMPLETO
- `sdr-proactive-outreach`: edge function dedicada que **abre uma nova conversa no Blue Chat** (`POST /conversations`), gera uma mensagem personalizada com IA, envia via Blue Chat API, e registra tudo no banco. Ela já funciona como SDR ativo.
- `cadence-runner`: quando o canal da empresa é `BLUECHAT`, já chama `dispararViaBluechat()`, que verifica se existe conversa aberta, e se não existir **abre uma nova** automaticamente e envia o template da cadência.
- `bluechat-proxy`: proxy frontend com ações `list-agents`, `transfer-ticket`, `open-conversation`, `send-message`, `get-frontend-url` — tudo que o painel precisa para agir sobre o Blue Chat.

### Transferência para vendedor — COMPLETO
Já existe tanto via `bluechat-proxy` (transferência manual pelo painel) quanto via callback automático da `bluechat-inbound` quando a Amélia detecta que o lead é um SQL e sinaliza `ESCALATE`.

---

## O que falta ou precisa de atenção

Mesmo com toda essa base, há **3 lacunas reais** para o novo modelo funcionar de ponta a ponta:

### 1. Não há interface no painel para disparar a Amélia em modo SDR ativo sobre um lead do pipeline

A `sdr-proactive-outreach` existe, mas só pode ser chamada via API/cron. Não há botão no DealCard, no painel de conversas, ou em qualquer lugar do frontend para um vendedor clicar em "Abrir conversa no Blue Chat via Amélia" para um lead específico do pipeline.

### 2. A flag de canal (`integration_company_config`) precisa estar configurada como `bluechat` para que as cadências fluam pelo Blue Chat

Isso é configuração de banco, não de código — mas precisa ser documentado e verificado. Se a flag não estiver ativa, o `cadence-runner` continua tentando mandar pelo WhatsApp direto (`DIRECT`), ignorando o Blue Chat.

### 3. Não há tela de visibilidade de "conversas ativas da Amélia no Blue Chat" dentro do painel

Quando a Amélia abre uma conversa proativamente, o vendedor vê no Blue Chat, mas dentro do CRM/pipeline não há uma visão centralizada mostrando "esses N leads estão sendo abordados pela Amélia agora". O `etiqueta: 'Atendimento IA'` existe no deal, mas não há filtro visual dedicado para isso no pipeline.

---

## Diagnóstico resumido

```text
Funcionalidade                               Status
──────────────────────────────────────────── ─────────────────────
Receber msgs do Blue Chat + responder (IA)   ✅ Completo
Criar lead + deal automaticamente (inbound)  ✅ Completo  
Escalação para humano (ESCALATE → transfer)  ✅ Completo
Encerramento de ticket (RESOLVE)             ✅ Completo
Abrir conversa nova proativamente (API)      ✅ Completo (edge function)
Cadências fluindo pelo Blue Chat             ✅ Completo (se canal = BLUECHAT)
Transferência manual pelo painel             ✅ Completo (bluechat-proxy)
Deep link para abrir conversa no Blue Chat   ✅ Completo (ConversationPanel)

Botão "Abordar via Amélia" no pipeline/deal  ❌ Falta UI
Visão de "Leads em atendimento IA" no CRM    ❌ Falta (só etiqueta no kanban)
```

---

## O que precisa ser feito

### Prioridade alta: Botão "Abordar via Amélia" no painel

Adicionar no `DealCard` ou na tela de detalhes do deal/lead um botão que chame `sdr-proactive-outreach` com o `lead_id` e `empresa` do lead atual. O resultado (link direto para a conversa no Blue Chat) pode abrir em nova aba.

**Onde colocar**: na `ConversationTakeoverBar` ou como ação rápida no `DealCard` (somente visível quando canal = BLUECHAT e modo = SDR_IA e sem conversa ativa ainda).

### Prioridade média: Filtro "Atendimento IA" no Kanban

O campo `etiqueta = 'Atendimento IA'` já é setado pela `sdr-proactive-outreach`. Adicionar um filtro rápido no Kanban para exibir só esses deals já daria visibilidade completa.

---

## O que NÃO precisa ser refeito

A arquitetura do Blue Chat como canal principal está pronta. Não há necessidade de "preparar" a integração — ela já existe. O que falta é apenas a **superfície de acionamento manual no frontend** e uma **visão de pipeline dos leads em atendimento IA**.

Posso implementar o botão "Abordar via Amélia" na tela de detalhes do deal/lead e o filtro de Kanban se quiser prosseguir.
