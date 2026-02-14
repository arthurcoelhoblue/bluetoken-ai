
# Fase 2: CS Proativo e Automatizado

A Fase 2 transforma o modulo CS de manual para proativo, com automacoes de NPS, deteccao de incidencias por IA, alertas de renovacao, briefing diario e playbooks ativados por triggers.

---

## Bloco 1: NPS Automatico via Cadencia

### O que faz
Apos 90 dias de um deal ganho, envia automaticamente uma pesquisa NPS ao cliente via WhatsApp ou email. Usa a tabela `cs_playbooks` (ja criada na Fase 1) para configurar o trigger.

### Implementacao
1. **Edge function `cs-nps-auto`**: Roda via cron (diario), busca clientes com `data_primeiro_ganho` >= 90 dias atras que ainda NAO tem pesquisa NPS registrada. Para cada um:
   - Cria registro em `cs_surveys` com `tipo=NPS`, `canal_envio=WHATSAPP`, `enviado_em=now()`
   - Envia mensagem via `whatsapp-send` com template NPS perguntando a nota 0-10
   - Marca como enviado

2. **Webhook de resposta**: Quando o lead responde com um numero (0-10), o `whatsapp-inbound` ou `bluechat-inbound` detecta que e resposta NPS e:
   - Atualiza `cs_surveys.nota` e `respondido_em`
   - Atualiza `cs_customers.ultimo_nps` e `nps_categoria`
   - Dispara recalculo do health score

### Arquivos
- `supabase/functions/cs-nps-auto/index.ts` (Criar)
- `supabase/config.toml` (Adicionar function)
- Cron job via `cron.schedule` (INSERT SQL)

---

## Bloco 2: Deteccao Automatica de Incidencias por IA

### O que faz
Analisa sentimento das mensagens inbound dos leads/clientes CS. Quando detecta sequencia de sentimento negativo (2+ mensagens NEGATIVO consecutivas), cria automaticamente uma incidencia em `cs_incidents`.

### Implementacao
1. **Edge function `cs-incident-detector`**: Roda via cron (a cada 6h) ou pode ser chamada inline pelo `sdr-ia-interpret`.
   - Busca clientes CS ativos
   - Para cada cliente, verifica `lead_message_intents` das ultimas 48h
   - Se encontrar 2+ intents com `sentimento = NEGATIVO` consecutivos:
     - Cria incidencia em `cs_incidents` com `tipo=RECLAMACAO`, `gravidade=MEDIA`, `detectado_por_ia=true`
     - Cria notificacao para o CSM
   - Se encontrar 3+ negativos: gravidade = ALTA
   - Evita duplicatas verificando se ja existe incidencia aberta recente (24h) para o mesmo cliente

### Arquivos
- `supabase/functions/cs-incident-detector/index.ts` (Criar)
- `supabase/config.toml` (Adicionar function)

---

## Bloco 3: Alertas de Renovacao Proativos

### O que faz
Monitora `cs_customers.proxima_renovacao` e cria notificacoes automaticas nos marcos 60, 30 e 15 dias antes da renovacao.

### Implementacao
1. **Edge function `cs-renewal-alerts`**: Roda via cron (diario).
   - Busca clientes com `proxima_renovacao` nos intervalos 60, 30, 15 dias
   - Verifica se notificacao ja foi enviada para aquele marco (evita duplicatas)
   - Cria notificacao para o CSM com contexto: health score, MRR, ultimas incidencias
   - Se health_status = EM_RISCO ou CRITICO, marca notificacao como urgente

### Arquivos
- `supabase/functions/cs-renewal-alerts/index.ts` (Criar)
- `supabase/config.toml` (Adicionar function)

---

## Bloco 4: Briefing Diario do CSM

### O que faz
Gera um resumo diario para cada CSM com: clientes em risco, renovacoes proximas, incidencias abertas, NPS pendentes, acoes sugeridas pela IA.

### Implementacao
1. **Edge function `cs-daily-briefing`**: Roda via cron (8h da manha).
   - Para cada CSM (profiles com clientes CS atribuidos):
     - Conta clientes por health_status
     - Lista renovacoes nos proximos 30 dias
     - Lista incidencias abertas
     - Chama Lovable AI (gemini-3-flash-preview) para gerar resumo actionavel
     - Salva briefing em `notifications` com tipo `CS_BRIEFING`
   - O briefing aparece no NotificationBell do CSM

### Arquivos
- `supabase/functions/cs-daily-briefing/index.ts` (Criar)
- `supabase/config.toml` (Adicionar function)

---

## Bloco 5: Playbooks CS Ativados por Triggers

### O que faz
Usa a tabela `cs_playbooks` para definir cadencias CS automaticas ativadas por eventos como: health degradou, renovacao proxima, NPS detrator, incidencia critica.

### Implementacao
1. **Tela de Playbooks** (`/cs/playbooks`): CRUD para playbooks com:
   - Trigger type: HEALTH_DEGRADED, RENEWAL_NEAR, NPS_DETRACTOR, INCIDENT_CRITICAL
   - Steps: array de acoes (enviar email, criar tarefa, notificar CSM, agendar call)
   - Configuracao: delays entre steps, condicoes de parada

2. **Engine de execucao**: Integrada no `cs-health-calculator` e `cs-renewal-alerts`:
   - Quando health degrada para EM_RISCO -> busca playbook com trigger HEALTH_DEGRADED
   - Executa primeiro step, agenda proximos via cadence runner

### Arquivos
- `src/pages/cs/CSPlaybooksPage.tsx` (Criar)
- `src/hooks/useCSPlaybooks.ts` (Criar)
- Atualizar `App.tsx` com rota `/cs/playbooks`

---

## Bloco 6: Health Score Recalculado por Eventos

### O que faz
Em vez de depender apenas do cron, recalcula o health score em tempo real quando eventos relevantes acontecem: nova pesquisa respondida, nova incidencia, deal ganho/perdido.

### Implementacao
1. **Trigger SQL**: Apos INSERT em `cs_surveys` (com nota), `cs_incidents`, ou UPDATE em `deals` (status mudou):
   - Chama `cs-health-calculator` via `pg_net.http_post` para recalcular o score do cliente afetado

### Arquivos
- Migration SQL para triggers de recalculo
- Nenhum arquivo frontend novo

---

## Ordem de Execucao

1. **Bloco 3**: Alertas de renovacao (mais simples, valor imediato)
2. **Bloco 2**: Deteccao de incidencias por IA
3. **Bloco 6**: Health score por eventos (migration SQL)
4. **Bloco 1**: NPS automatico
5. **Bloco 4**: Briefing diario
6. **Bloco 5**: Playbooks (mais complexo, depende dos anteriores)

---

## Resumo de Entregas

| Item | Tipo | Arquivo |
|------|------|---------|
| cs-renewal-alerts | Edge Function | supabase/functions/cs-renewal-alerts/index.ts |
| cs-incident-detector | Edge Function | supabase/functions/cs-incident-detector/index.ts |
| cs-nps-auto | Edge Function | supabase/functions/cs-nps-auto/index.ts |
| cs-daily-briefing | Edge Function | supabase/functions/cs-daily-briefing/index.ts |
| Triggers recalculo health | Migration SQL | Via migration tool |
| CSPlaybooksPage | Pagina React | src/pages/cs/CSPlaybooksPage.tsx |
| useCSPlaybooks | Hook | src/hooks/useCSPlaybooks.ts |
| config.toml | Update | 4 novas functions |
| App.tsx | Update | 1 nova rota |
| Cron jobs | INSERT SQL | 4 cron schedules |
