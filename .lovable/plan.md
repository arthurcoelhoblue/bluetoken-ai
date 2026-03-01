

## Plano: Corrigir filtros do sininho + adicionar navegação acionável nos insights do Copilot

### Problema 1: Filtros do sininho não mostram nada

Os filtros (Alertas, Insights, Deals) mapeiam tipos como `SLA_ESTOURADO`, `LEAD_QUENTE`, etc., mas as notificações reais no banco usam tipos diferentes: `INFO`, `DEAL_NOVO_PRIORITARIO`, `AMELIA_ALERTA`, `ALERTA`, `CS_CHURN_RISK`, `CS_BRIEFING`, `SYSTEM_ALERT`.

**Solução em `NotificationBell.tsx`:**
- Atualizar `FILTER_GROUPS` para incluir TODOS os tipos reais usados no sistema:
  - **ALERTAS**: `SLA_ESTOURADO`, `AMELIA_ALERTA`, `AMELIA_SEQUENCIA`, `ALERTA`, `SYSTEM_ALERT`, `CS_CHURN_RISK`
  - **INSIGHTS**: `AMELIA_INSIGHT`, `AMELIA_CORRECAO`, `LEAD_QUENTE`, `INFO`, `CS_BRIEFING`
  - **DEALS**: `DEAL_PARADO`, `DEAL_AUTO_CRIADO`, `DEAL_NOVO_PRIORITARIO`
- Atualizar `TIPO_LABELS` para incluir os tipos novos (`DEAL_NOVO_PRIORITARIO`, `ALERTA`, `CS_CHURN_RISK`, `CS_BRIEFING`, `SYSTEM_ALERT`, `INFO`)
- Adicionar contadores por grupo nos botões de filtro para o usuário ver quantas notificações tem em cada aba

---

### Problema 2: Insights do Copilot não levam à ação

Os insights mencionam leads e deals pelo nome, mas `lead_id` e `deal_id` são quase sempre `null` (a IA não retorna UUIDs de forma confiável). Mesmo quando há link, só aparece o botão "Ver perfil" ou "Ver negócio" — falta navegação por categoria.

**Solução em `CopilotInsightCard.tsx`:**
- Adicionar navegação baseada na **categoria** do insight quando não há `lead_id`/`deal_id`:
  - `FOLLOW_UP` → `/conversas` (ir para a tela de conversas)
  - `DEAL_PARADO` → `/pipeline` (ir para o pipeline)
  - `SLA_RISCO` → `/pipeline` (ver SLAs)
  - `META_RISCO` → `/meu-dia` (ver metas)
  - `COACHING` / `PADRAO_POSITIVO` → sem link (informativo)
- O card inteiro fica clicável quando há uma ação associada, com cursor pointer e hover visual
- Manter os links específicos de lead/deal quando disponíveis (prioridade sobre o link por categoria)

**Solução no backend `copilot-proactive/index.ts`:**
- Adicionar um campo `action_url` opcional no prompt da IA para que ela sugira a rota de destino
- Ao inserir os insights, mapear a categoria para uma URL de ação padrão quando a IA não retornar `lead_id`/`deal_id`
- Salvar essa URL no campo de metadata ou usar a lógica de mapeamento no frontend

### Detalhes técnicos

Arquivos alterados:
1. `src/components/layout/NotificationBell.tsx` — atualizar `FILTER_GROUPS`, `TIPO_LABELS`, adicionar contadores
2. `src/components/copilot/CopilotInsightCard.tsx` — adicionar mapeamento categoria→rota, tornar card clicável por categoria

Nenhuma mudança no banco de dados necessária.

