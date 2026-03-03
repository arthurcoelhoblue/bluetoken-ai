

## Avaliacao da PR #4 — Sistema de Agendamento Google Calendar + Reunioes

### Resumo

Branch `feature/google-calendar-meetings` (PR #4) com 8 commits, +2.896/-1 linhas em 12 arquivos. Sistema completo de agendamento de reunioes via Google Calendar integrado ao SDR IA.

**Arquivos:**
- 1 migration SQL
- 4 edge functions novas (`google-calendar-auth`, `calendar-slots`, `calendar-book`, `meeting-transcription`)
- 1 modificacao em edge function existente (`sdr-ia-interpret/index.ts`)
- 2 hooks (`useCalendarConfig.ts`, `useMeetings.ts`)
- 2 componentes (`CalendarConfigPanel.tsx`, `DealMeetingsTab.tsx`)
- 1 modificacao em componente existente (`DealDetailSheet.tsx`)

---

### Patch 1: Migration SQL — APROVADO com ajustes criticos

**Tabelas criadas:** `user_google_tokens`, `user_availability`, `user_meeting_config`, `meetings`, `meeting_transcripts`, `meeting_scheduling_state`

**Problemas identificados (3):**

1. **CRITICO — Schema mismatch na `meetings`** (P1): A migration cria uma tabela `meeting_transcripts` separada, mas a edge function `meeting-transcription` escreve diretamente em `meetings.transcricao_metadata`, `transcricao_processada` e `transcricao_processada_em`. Essas colunas nao existem na tabela `meetings`. **Correcao**: eliminar `meeting_transcripts` e adicionar as colunas de transcricao diretamente na tabela `meetings`.

2. **CRITICO — UNIQUE constraint bloqueante** (P1): `UNIQUE(lead_id, empresa, status)` na `meeting_scheduling_state` impede multiplos agendamentos para o mesmo lead/empresa com mesmo status (ex: dois ACEITO). **Correcao**: usar partial unique index `WHERE status = 'PENDENTE'`.

3. **RLS precisa ser verificada**: As policies devem restringir por empresa via `get_user_empresas()`, seguindo o padrao do projeto.

---

### Patch 2: Google Calendar Auth — APROVADO com ajuste critico

**Edge function** com fluxo OAuth2 completo (get_auth_url, callback, refresh, disconnect, status).

**Problemas identificados (1):**

1. **CRITICO — Env vars inconsistentes** (P1): Esta funcao usa `GOOGLE_CALENDAR_CLIENT_ID/SECRET`, mas `calendar-book` usa `GOOGLE_CLIENT_ID/SECRET`. Em producao, configurar apenas um set de nomes faz metade do fluxo falhar. **Correcao**: padronizar para `GOOGLE_CALENDAR_CLIENT_ID/SECRET` em todas as funcoes.

---

### Patch 3: Configuracao de Disponibilidade — APROVADO

**Hook** `useCalendarConfig` e **componente** `CalendarConfigPanel` para configurar horarios, duracao e Google Meet.

**Problemas:** Nenhum significativo. Codigo limpo, permissoes admin/proprio usuario bem tratadas.

---

### Patch 4: Calendar Slots — APROVADO

**Edge function** que cruza disponibilidade configurada + Google FreeBusy API + meetings existentes. Retorna 3 horarios livres com labels em pt-BR.

**Problemas:** Nenhum significativo. Logica de diversidade de dias e tratamento de timezone esta boa.

---

### Patch 5: Meeting Scheduler no SDR — APROVADO com ajuste critico

**Modulo** `meeting-scheduler.ts` integrado ao `sdr-ia-interpret`.

**Problemas identificados (1):**

1. **CRITICO — dealId usa Pipedrive ID** (P1): Atribui `parsedContext.pipedriveDealeId` (identificador externo) ao `dealId` que e persistido como UUID foreign key em `meetings.deal_id`. Causa erro de FK/UUID invalido. **Correcao**: usar o deal interno (`parsedContext.dealId` ou resolver via contact).

---

### Patch 6: Calendar Book — APROVADO com ajuste

**Edge function** que cria evento no Google Calendar com Meet link.

**Problemas identificados (1):**
1. **Env vars inconsistentes** (P1 — mesmo que Patch 2): Usa `GOOGLE_CLIENT_ID/SECRET` em vez de `GOOGLE_CALENDAR_CLIENT_ID/SECRET`. **Correcao**: padronizar.
2. **deal_activities insert usa campos inexistentes** (P2): Insere `titulo`, `data_agendada`, `status`, `criado_por` que provavelmente nao existem na tabela `deal_activities`. **Correcao**: usar os campos corretos (`tipo`, `descricao`, `metadata`, `user_id`).

---

### Patch 7: Meeting Transcription — APROVADO com ajustes

**Edge function** que extrai metadados de transcricoes via LLM.

**Problemas identificados (2):**

1. **CRITICO — Colunas inexistentes** (P1, mesmo que Patch 1): Escreve em `meetings.transcricao_metadata/processada/processada_em` que nao existem no schema original. **Correcao**: resolver no Patch 1.

2. **API callAI incompativel** (P2): O PR usa `callAI({ model, messages, temperature, max_tokens })` no estilo OpenAI, mas o `callAI` real usa `{ system, prompt, functionName, supabase, temperatura, maxTokens }`. **Correcao**: adaptar para a assinatura real.

---

### Patch 8: UI — APROVADO

**Componentes** `DealMeetingsTab` e alteracao no `DealDetailSheet` (nova aba "Reunioes").

**Problemas:** Hook `useMeetings` usa type casts (`as Meeting[]`) que serao resolvidos automaticamente apos migration. Restante e limpo.

---

### Plano de Execucao

Implementarei os 8 patches consolidados com todas as correcoes, nesta ordem:

**Passo 1 — Migration SQL**
- Tabelas: `user_google_tokens`, `user_availability`, `user_meeting_config`, `meetings` (COM colunas de transcricao inline), `meeting_scheduling_state`
- Eliminar tabela `meeting_transcripts` separada
- Partial unique index `WHERE status = 'PENDENTE'` na scheduling state
- RLS restritiva por empresa via `get_user_empresas()`
- Triggers de `updated_at`

**Passo 2 — Edge Functions (4 novas)**
- `google-calendar-auth/index.ts` — OAuth2 flow (env vars padronizadas)
- `calendar-slots/index.ts` — buscar horarios livres
- `calendar-book/index.ts` — criar evento (env vars corrigidas, deal_activities corrigido)
- `meeting-transcription/index.ts` — extrai metadados (callAI adaptado para assinatura real)

**Passo 3 — Hooks e Componentes UI (4 novos)**
- `src/hooks/useCalendarConfig.ts`
- `src/hooks/useMeetings.ts`
- `src/components/calendar/CalendarConfigPanel.tsx`
- `src/components/deals/DealMeetingsTab.tsx`

**Passo 4 — Modificacao em arquivo existente**
- `DealDetailSheet.tsx` — nova aba "Reunioes" com icone Video

**Nota: Patch 5 (meeting-scheduler no SDR) sera implementado como arquivo separado** dentro de `sdr-ia-interpret/`, mas a integracao no `index.ts` sera feita com cuidado para nao quebrar o fluxo existente, corrigindo o bug do `dealId`.

