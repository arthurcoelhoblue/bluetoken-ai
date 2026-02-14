
# Blocos 4 e 6: Health Calculator + Copilot CS

Estes sao os dois blocos finais do modulo CS Fase 1. O Bloco 4 cria a edge function que calcula o health score de cada cliente CS com base em 6 dimensoes ponderadas. O Bloco 6 enriquece o Copilot da Amelia com dados CS para que CSMs possam perguntar sobre a situacao de clientes.

---

## Bloco 4: Edge Function `cs-health-calculator`

### O que faz
Calcula o health score (0-100) de um ou todos os clientes CS, baseado em 6 dimensoes ponderadas:

| Dimensao | Peso | Fonte de dados |
|----------|------|----------------|
| NPS | 20% | Ultimo NPS em `cs_surveys` |
| CSAT | 15% | Media dos ultimos 3 CSATs em `cs_surveys` |
| Engajamento | 20% | Contagem de atividades em `deal_activities` nos ultimos 30 dias para deals do contato |
| Financeiro | 20% | Ratio deals ganhos vs total para o contato |
| Tempo | 10% | Meses desde `data_primeiro_ganho` (mais tempo = mais saudavel, cap em 24 meses) |
| Sentimento | 15% | Media de `sentiment_score` das ultimas pesquisas respondidas |

### Logica principal
1. Recebe `customer_id` (individual) ou nenhum (batch para todos ativos)
2. Para cada cliente: consulta dados das 6 dimensoes
3. Calcula score ponderado (0-100)
4. Determina `health_status` pelos thresholds: >=75 SAUDAVEL, >=55 ATENCAO, >=35 EM_RISCO, <35 CRITICO
5. Se score mudou em relacao ao anterior, salva em `cs_health_log` com breakdown
6. Atualiza `cs_customers.health_score` e `health_status`
7. Se cruzou threshold de status (ex: ATENCAO -> EM_RISCO), cria notificacao para o CSM

### Arquivo
- `supabase/functions/cs-health-calculator/index.ts`
- Adicionar `[functions.cs-health-calculator] verify_jwt = false` no config.toml

---

## Bloco 6: Copilot Enriquecido com Dados CS

### O que muda
Adicionar novo `contextType = 'CUSTOMER'` no `copilot-chat` edge function e criar funcao `enrichCustomerContext()`.

### Dados injetados no contexto da IA
- Health score atual, status, breakdown das 6 dimensoes
- Ultimo NPS e CSAT com datas
- Incidencias abertas (titulo, gravidade, data)
- Proxima renovacao e valor MRR
- Deals vinculados (ganhos e abertos)
- Notas do CSM

### Alteracoes
- Atualizar `ContextType` para incluir `'CUSTOMER'`
- Adicionar case `'CUSTOMER'` no switch
- Implementar `enrichCustomerContext(supabase, customerId)`
- Atualizar `SYSTEM_PROMPT` para incluir diretriz CS: "Para contexto de Customer Success, foque em retencao, saude do cliente e acoes proativas"

---

## Resumo de arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/cs-health-calculator/index.ts` | Criar |
| `supabase/functions/copilot-chat/index.ts` | Editar (adicionar CUSTOMER context) |
| `supabase/config.toml` | Adicionar config do cs-health-calculator |

---

## Detalhes tecnicos

### Health Calculator - Pseudocodigo das dimensoes

```text
NPS (20%):
  ultimo NPS 0-10 -> normalizado para 0-100 (nota * 10)
  sem NPS -> score 50 (neutro)

CSAT (15%):
  media ultimos 3 CSATs (0-5) -> normalizado para 0-100 (media * 20)
  sem CSAT -> score 50

Engajamento (20%):
  count atividades 30 dias -> 0 = 0, 1-3 = 40, 4-8 = 70, 9+ = 100

Financeiro (20%):
  deals ganhos / total deals do contato -> ratio * 100
  sem deals -> score 50

Tempo (10%):
  meses desde data_primeiro_ganho, cap 24 -> (meses / 24) * 100

Sentimento (15%):
  media sentiment_score das pesquisas respondidas (ja 0-1) -> * 100
  sem dados -> score 50
```

### Copilot - enrichCustomerContext retorna string formatada
```text
**Cliente CS**: Nome | Email | Tel
**Health Score**: 72/100 (ATENCAO)
**Dimensoes**: NPS=80, CSAT=60, Engajamento=70, Financeiro=85, Tempo=50, Sentimento=65
**Ultimo NPS**: 7 (Neutro) em 15/01/2026
**MRR**: R$ 5.000 | Renovacao: 15/04/2026
**Incidencias Abertas**: 2 (1 Alta, 1 Media)
**Notas CSM**: "Cliente pediu reuniao para discutir expansao"
```
