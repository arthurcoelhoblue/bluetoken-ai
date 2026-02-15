

# Copilot Omnisciente + Ativo com Historico Persistente

## Problema Atual

1. **Copilot nao persiste historico**: Mensagens ficam em `useState` e somem ao fechar o Sheet. A tabela `copilot_messages` ja existe no banco mas nao e utilizada.
2. **Copilot passivo**: So responde quando o vendedor pergunta. Nao monitora acoes nem oferece insights proativos.
3. **Contexto limitado**: O enriquecimento `GERAL` traz apenas resumo de pipeline/leads/metas. Nao ve cadencias, conversas recentes, atividades do vendedor, nem deals parados.

---

## Parte 1: Persistencia de Historico

A tabela `copilot_messages` ja existe com os campos `user_id, context_type, context_id, empresa, role, content, model_used, tokens_input, tokens_output, latency_ms, created_at`.

### Mudancas no Frontend (`CopilotPanel.tsx`)

- Ao abrir o Sheet, carregar ultimas mensagens do banco filtradas por `user_id + context_type + context_id + empresa`
- Ao enviar/receber mensagem, salvar na tabela `copilot_messages`
- Agrupar por "sessao" usando a logica: se a ultima mensagem tem mais de 4 horas, iniciar nova conversa (separador visual "Nova conversa")
- Botao "Limpar historico" para apagar mensagens do contexto atual

### Mudancas no Backend (`copilot-chat/index.ts`)

- Apos receber resposta da IA, salvar ambas as mensagens (user + assistant) na tabela
- Retornar `message_id` na resposta para o frontend vincular

### Novo Hook: `useCopilotMessages.ts`

```typescript
// Carrega historico de mensagens do copilot
// Filtra por user_id, context_type, context_id, empresa
// Ordena por created_at ASC
// Limite: ultimas 50 mensagens
```

---

## Parte 2: Copilot Omnisciente (Enriquecimento Total)

Expandir drasticamente o contexto que a IA recebe no modo `GERAL`, para que ela veja TUDO do vendedor.

### Dados adicionais no `enrichGeralContext`:

| Dado | Fonte | Descricao |
|------|-------|-----------|
| Deals do vendedor | `deals` + `pipeline_stages` | Todos deals abertos com estagio, valor, dias parado |
| Atividades recentes | `deal_activities` | Ultimas 20 atividades do vendedor (tarefas, notas, emails) |
| Cadencias ativas | `lead_cadence_runs` | Runs ativas com status, lead, proxima acao |
| Conversas recentes | `lead_messages` | Ultimas 15 mensagens inbound/outbound |
| Leads quentes | `lead_classifications` | Leads com temperatura QUENTE/MORNA |
| Performance | `metas_vendedor` + deals ganhos/perdidos | Taxa de conversao, meta atingida |
| Tarefas pendentes | `workbench_tarefas` | Tarefas do vendedor nao concluidas |
| SLA estourados | `workbench_sla_alerts` | Deals com SLA estourado do vendedor |

Isso torna a Amelia um oraculo que ve absolutamente tudo do contexto do vendedor.

---

## Parte 3: Copilot Ativo (Insights Proativos)

### Novo componente: `CopilotProactiveInsights`

Exibido no topo do painel do Copilot quando aberto. Gera insights automaticos baseados em padroes detectados nos dados.

### Nova Edge Function: `copilot-proactive/index.ts`

Chamada periodicamente (a cada 30min via polling no frontend, ou ao abrir o Copilot se cache expirado).

A funcao:
1. Carrega snapshot completo do vendedor (mesmos dados da Parte 2)
2. Envia para a IA com prompt especifico de "coaching"
3. Retorna lista de insights categorizados

### Categorias de Insight Proativo

| Categoria | Exemplo |
|-----------|---------|
| `DEAL_PARADO` | "Deal 'Marcos Bertoldi' esta ha 5 dias sem atividade no estagio Proposta" |
| `SLA_RISCO` | "3 deals estao com SLA acima de 80%, priorize contato" |
| `FOLLOW_UP` | "Lead Ana respondeu ha 2h, ainda sem retorno seu" |
| `META_RISCO` | "Voce esta em 45% da meta com 8 dias uteis restantes" |
| `PADRAO_POSITIVO` | "Sua taxa de resposta subiu 15% esta semana, continue assim!" |
| `COACHING` | "Seus deals no estagio Proposta tem taxa de conversao 20% abaixo da media" |

### Prompt de Coaching

```text
Voce e a Amelia no modo COACHING ATIVO.
Analise os dados do vendedor e gere 3-5 insights acionaveis.
Priorize: deals parados, SLA estourados, follow-ups urgentes, riscos de meta.
Inclua tambem um feedback positivo quando houver melhoria.
Formato: JSON array com {categoria, titulo, descricao, prioridade, deal_id?}
```

### Exibicao no Frontend

- Cards de insight aparecem no topo do CopilotPanel quando aberto
- Badge numerico no icone do Copilot na TopBar mostrando quantidade de insights pendentes
- Vendedor pode "dispensar" insight (salvo para nao repetir)
- Gestao pode ver insights agregados de todos vendedores (futuro)

---

## Parte 4: Copilot para Gestao

No contexto `GERAL` quando o usuario e ADMIN:
- Mostrar dados de TODOS os vendedores (nao so do logado)
- Incluir comparativo entre vendedores
- Insights de coaching para o gestor tipo "Vendedor X esta com taxa baixa, considere mentoring"

---

## Arquivos a Criar/Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useCopilotMessages.ts` | **Novo** - CRUD de historico persistente |
| `src/hooks/useCopilotInsights.ts` | **Novo** - Busca insights proativos |
| `src/components/copilot/CopilotPanel.tsx` | Persistencia + exibicao de insights + badge |
| `src/components/copilot/CopilotInsightCard.tsx` | **Novo** - Card de insight proativo |
| `src/components/layout/TopBar.tsx` | Badge de insights no icone do Copilot |
| `supabase/functions/copilot-chat/index.ts` | Enriquecimento total + salvar mensagens |
| `supabase/functions/copilot-proactive/index.ts` | **Novo** - Geracao de insights proativos |
| **Migracao SQL** | Tabela `copilot_insights` + indice em `copilot_messages` |

### Migracao SQL

```sql
-- Tabela de insights proativos
CREATE TABLE public.copilot_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  empresa empresa_tipo NOT NULL,
  categoria TEXT NOT NULL, -- DEAL_PARADO, SLA_RISCO, etc.
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  prioridade TEXT NOT NULL DEFAULT 'MEDIA',
  deal_id UUID REFERENCES deals(id),
  lead_id UUID,
  dispensado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE copilot_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own insights" ON copilot_insights
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- Indice para busca rapida de historico
CREATE INDEX idx_copilot_messages_user_ctx 
  ON copilot_messages(user_id, context_type, context_id, empresa, created_at DESC);
```

## Ordem de Implementacao

1. Migracao SQL (tabela insights + indice)
2. Hook `useCopilotMessages` + persistencia no `CopilotPanel`
3. Enriquecimento total no backend (`enrichGeralContext` expandido)
4. Edge function `copilot-proactive` + hook `useCopilotInsights`
5. UI de insights no CopilotPanel + badge na TopBar

