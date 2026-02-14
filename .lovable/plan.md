

# Sprint 2 -- IA-First de Verdade

Implementacao dos 6 itens do roadmap da auditoria tecnica (Secao 7 + Secao 9, Sprint 2).

---

## Escopo

| # | Item | Esforco | Impacto |
|---|------|---------|---------|
| 14 | Next Best Action no "Meu Dia" | 3d | DIFERENCIAL |
| 15 | Deal auto-creation de lead qualificado | 2d | Reduz friccao |
| 16 | Auto-fill de campos via conversa (valor, necessidade) | 2d | Reduz registro |
| 17 | Notificacoes proativas (browser push + email digest) | 3d | Engajamento |
| 18 | Scoring de probabilidade nos deal cards | 2d | Inteligencia visual |
| 19 | Copilot enriquecido (custom fields, organizations) | JA FEITO | -- |

O item 19 ja foi implementado -- o `copilot-chat` ja busca custom fields de deals e contatos, e dados de organizacoes. Nao sera incluido nesta sprint.

---

## Item 14: Next Best Action no "Meu Dia"

### O que muda
O WorkbenchPage ganha um card de destaque no topo: "O que fazer agora" com 3-5 sugestoes priorizadas por IA baseadas nos dados reais do vendedor.

### Implementacao

**Nova edge function `next-best-action`:**
- Recebe `user_id` e `empresa`
- Busca: tarefas pendentes, SLA alerts, deals parados ha mais tempo, leads quentes sem follow-up, cadencias com acoes pendentes
- Envia tudo como contexto ao Lovable AI Gateway (google/gemini-3-flash-preview) com tool calling
- Retorna array estruturado: `[{ titulo, motivo, deal_id?, lead_id?, prioridade, tipo_acao }]`
- Usa tool calling para extrair output estruturado (nao JSON livre)

**Novo hook `useNextBestAction`:**
- Chama a edge function via `supabase.functions.invoke`
- Cache de 5 minutos (staleTime)
- Botao de refresh manual

**UI no WorkbenchPage:**
- Card "Proximo Passo" entre o greeting e os KPI cards
- Lista de 3-5 acoes com icone por tipo (tarefa, follow-up, SLA, deal parado)
- Click na acao navega para o deal ou contato relevante
- Skeleton loading enquanto IA processa
- Badge de prioridade (ALTA/MEDIA/BAIXA)

### Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/next-best-action/index.ts` | Novo |
| `src/hooks/useNextBestAction.ts` | Novo |
| `src/components/workbench/NextBestActionCard.tsx` | Novo |
| `src/pages/WorkbenchPage.tsx` | Editar (adicionar card) |

---

## Item 15: Deal Auto-Creation de Lead Qualificado

### O que muda
Quando o SDR IA determina `CRIAR_TAREFA_CLOSER`, alem de pausar cadencia e notificar closer, o sistema cria automaticamente um deal no pipeline default da empresa.

### Implementacao

**Alterar `sdr-ia-interpret` (case CRIAR_TAREFA_CLOSER):**
1. Buscar pipeline default da empresa (`is_default = true`)
2. Buscar primeiro stage ativo (posicao mais baixa, nao won/lost)
3. Buscar ou criar `contact` vinculado ao `lead_id` (usando `legacy_lead_id`)
4. Criar deal com:
   - `titulo`: intent_summary ou "Oportunidade - {nome_lead}"
   - `contact_id`: contact encontrado/criado
   - `pipeline_id` e `stage_id` do default
   - `temperatura`: QUENTE (lead qualificado)
   - `valor`: extraido de `acao_detalhes.valor_mencionado` se disponivel (vem do auto-fill, item 16)
   - `canal_origem`: 'SDR_IA'
5. Registrar activity `CRIACAO` no deal com metadata indicando origem SDR IA

**Salvaguardas:**
- Verificar se ja existe deal aberto para o mesmo contact_id no mesmo pipeline (evitar duplicatas)
- Logar a criacao no `lead_cadence_events`

### Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/sdr-ia-interpret/index.ts` | Editar (case CRIAR_TAREFA_CLOSER) |

---

## Item 16: Auto-Fill de Campos via Conversa

### O que muda
O SDR IA ja extrai dados via frameworks (SPIN, GPCT, BANT). Agora esses dados sao usados para pre-preencher o deal criado automaticamente (item 15) e ficam visiveis no deal detail.

### Implementacao

**Alterar prompt do SDR IA:**
- Adicionar campo `dados_extraidos` no output da tool call:
  ```
  dados_extraidos: {
    valor_mencionado: number | null,
    necessidade_principal: string | null,
    urgencia: "ALTA" | "MEDIA" | "BAIXA" | null,
    decisor_identificado: boolean,
    prazo_mencionado: string | null
  }
  ```
- Salvar esses dados em `acao_detalhes` do intent

**No deal auto-creation (item 15):**
- Usar `valor_mencionado` como valor do deal
- Usar `necessidade_principal` como sufixo do titulo
- Usar `urgencia` para definir temperatura (ALTA=QUENTE, MEDIA=MORNO, BAIXA=FRIO)
- Registrar todos os dados como metadata da activity CRIACAO

**UI no DealDetailSheet:**
- Na aba de atividades, a activity CRIACAO com origem SDR_IA mostra os dados extraidos como badges informativos

### Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/sdr-ia-interpret/index.ts` | Editar (prompt + parsing + auto-creation) |
| `src/components/deals/DealDetailSheet.tsx` | Editar (mostrar dados extraidos na activity) |

---

## Item 17: Notificacoes Proativas (Browser Push)

### O que muda
O vendedor recebe notificacoes em tempo real via browser quando:
- Lead quente respondeu
- SLA estourou
- Deal parado ha mais de X dias
- SDR IA qualificou lead e criou deal

### Implementacao

**Fase A: Notificacoes in-app (realtime):**

Nova tabela `notifications`:
```
id UUID PK
user_id UUID FK profiles
empresa TEXT
tipo TEXT (LEAD_QUENTE, SLA_ESTOURADO, DEAL_PARADO, DEAL_AUTO_CRIADO)
titulo TEXT
mensagem TEXT
link TEXT (rota para navegar)
entity_id TEXT
entity_type TEXT (DEAL, LEAD, CONTACT)
lida BOOLEAN DEFAULT false
created_at TIMESTAMPTZ
```

- Realtime subscription na tabela `notifications` filtrado por `user_id`
- Componente `NotificationBell` no TopBar com badge de contagem
- Dropdown com lista de notificacoes recentes
- Click navega para o link da notificacao e marca como lida

**Fase B: Emissores de notificacao:**

1. `sdr-ia-interpret` (CRIAR_TAREFA_CLOSER): insere notificacao para o closer/owner
2. Trigger SQL em `deals` quando `updated_at` muda e deal esta parado ha >7 dias: insere notificacao
3. `whatsapp-inbound` quando lead com classificacao QUENTE responde: insere notificacao

**Fase C: Browser Push (nativa):**
- Solicitar permissao de notificacao via `Notification.requestPermission()`
- Quando chegar notificacao via realtime, disparar `new Notification(titulo, { body: mensagem })`
- Preferencia de notificacoes por tipo na pagina de perfil (/me)

### Arquivos

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Nova tabela + RLS + realtime |
| `src/hooks/useNotifications.ts` | Novo |
| `src/components/layout/NotificationBell.tsx` | Novo |
| `src/components/layout/TopBar.tsx` | Editar (adicionar NotificationBell) |
| `src/pages/Me.tsx` | Editar (preferencias de notificacao) |
| `supabase/functions/sdr-ia-interpret/index.ts` | Editar (inserir notificacao) |
| `supabase/functions/whatsapp-inbound/index.ts` | Editar (inserir notificacao) |

---

## Item 18: Scoring de Probabilidade nos Deal Cards

### O que muda
Cada deal card no kanban mostra um percentual de probabilidade de fechamento calculado por uma formula baseada em dados historicos.

### Implementacao

**Nova funcao SQL `fn_calc_deal_score(deal_id UUID)`:**
Calcula score composto (0-100%) baseado em:
1. **Taxa historica do stage** (view `stage_conversion_rates` ja existe): peso 40%
2. **Tempo no stage vs media**: peso 20% (deals que ficam muito tempo perdem score)
3. **Temperatura**: QUENTE=+15, MORNO=+5, FRIO=-10: peso 15%
4. **Engagement scores** (ja existem `score_engajamento`, `score_intencao`, `score_valor`, `score_urgencia` no deal): peso 25% (media dos 4)

**Trigger de atualizacao:**
- Trigger `AFTER UPDATE ON deals` quando `stage_id` ou `temperatura` muda
- Salva resultado em nova coluna `score_probabilidade INTEGER` na tabela `deals`

**UI no DealCard:**
- Barra circular ou badge com percentual ao lado da temperatura
- Cor: verde (>70%), amarelo (40-70%), vermelho (<40%)
- Tooltip com breakdown do score

### Arquivos

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Coluna + funcao + trigger |
| `src/types/deal.ts` | Editar (adicionar score_probabilidade) |
| `src/components/pipeline/DealCard.tsx` | Editar (mostrar score) |

---

## Ordem de Implementacao

A sequencia respeita dependencias:

```text
1. [DB] Migracao: tabela notifications + coluna score_probabilidade + funcao scoring
2. [Backend] Edge function next-best-action
3. [Backend] sdr-ia-interpret: auto-fill (dados_extraidos) + auto-creation de deal + notificacoes
4. [Backend] whatsapp-inbound: notificacao de lead quente
5. [Frontend] NotificationBell + useNotifications + realtime
6. [Frontend] NextBestActionCard + useNextBestAction
7. [Frontend] DealCard com score de probabilidade
8. [Frontend] DealDetailSheet: dados extraidos na activity
```

---

## Detalhes Tecnicos

### Modelos de IA utilizados
- **Next Best Action**: google/gemini-3-flash-preview (rapido, custo baixo, chamado 1x por sessao)
- **SDR IA (auto-fill)**: mantém modelo atual (Anthropic Claude via API direta, conforme configuracao existente)

### Tabelas novas
- `notifications` com RLS por `user_id = auth.uid()`

### Colunas novas
- `deals.score_probabilidade` INTEGER DEFAULT 0

### Edge functions novas
- `next-best-action`

### Edge functions modificadas
- `sdr-ia-interpret` (auto-creation + auto-fill + notificacao)
- `whatsapp-inbound` (notificacao lead quente)

