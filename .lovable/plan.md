
# Plano: Modulo Customer Success (CS) -- Fase 1: Fundacao

Este plano implementa a **Fase 1 (Fundacao CS)** conforme descrito no relatorio, criando toda a infraestrutura de dados, telas e logica de negocios necessaria para que as equipes de Sucesso do Cliente da Blue Consult e Tokeniza operem de forma independente dentro do CRM.

---

## Visao Geral

O modulo CS transforma o Blue CRM de um sistema de vendas para um Revenue OS completo. Ele e proativo (diferente de suporte reativo), focado em reter clientes, reduzir churn e expandir receita. A Fase 1 entrega o minimo viavel: tabelas, dashboard, lista de clientes, detalhe do cliente, pesquisas manuais, incidencias manuais, health score calculado e copilot enriquecido.

---

## Bloco 1: Modelo de Dados (Migration SQL)

### 1.1 Tabela `cs_customers`
Registro de cada cliente no modulo CS, vinculado a `contacts`. Um contato vira cliente CS quando tem um deal com `status = 'GANHO'`.

Colunas principais:
- `contact_id` (FK contacts), `empresa` (empresa_tipo), `csm_id` (FK profiles)
- `health_score` (0-100), `health_status` (SAUDAVEL/ATENCAO/EM_RISCO/CRITICO)
- `ultimo_nps` (0-10), `nps_categoria`, `ultimo_csat`, `media_csat`
- `ultimo_contato_em`, `data_primeiro_ganho`, `proxima_renovacao`
- `valor_mrr`, `risco_churn_pct`, `sentiment_score`
- `tags` (TEXT[]), `notas_csm`, `is_active`

### 1.2 Tabela `cs_surveys`
Pesquisas NPS/CSAT/CES enviadas e respondidas.

Colunas: `customer_id` (FK), `empresa`, `tipo` (NPS/CSAT/CES), `canal_envio`, `pergunta`, `nota`, `texto_resposta`, `sentiment_ia`, `sentiment_score`, `keywords_ia` (JSONB), `contexto_atividade_id`, `enviado_em`, `respondido_em`.

### 1.3 Tabela `cs_incidents`
Incidencias/ocorrencias na jornada do cliente (nao e ticket de suporte).

Colunas: `customer_id`, `empresa`, `tipo` (RECLAMACAO/ATRASO/ERRO_OPERACIONAL/...), `gravidade` (BAIXA/MEDIA/ALTA/CRITICA), `titulo`, `descricao`, `origem`, `status` (ABERTA/EM_ANDAMENTO/RESOLVIDA/FECHADA), `responsavel_id`, `resolucao`, `impacto_health`, `detectado_por_ia`, `resolved_at`.

### 1.4 Tabela `cs_health_log`
Historico de snapshots do health score com explicacao IA.

Colunas: `customer_id`, `score`, `status`, `dimensoes` (JSONB com as 6 dimensoes), `motivo_mudanca`.

### 1.5 Tabela `cs_playbooks`
Cadencias CS com triggers especificos (para Fase 2, mas a tabela e criada agora).

Colunas: `empresa`, `nome`, `descricao`, `trigger_type`, `trigger_config` (JSONB), `steps` (JSONB), `is_active`.

### 1.6 Trigger automatico
Quando um deal muda para `status = 'GANHO'`, um trigger cria ou atualiza o registro em `cs_customers` automaticamente, marcando `data_primeiro_ganho`, `valor_mrr` e `is_active = true`.

### 1.7 RLS (Row Level Security)
Todas as 5 tabelas terao RLS habilitado com isolamento por empresa via `public.get_user_empresa(auth.uid())`:
- SELECT: usuario so ve registros da sua empresa (ou todos se empresa = NULL no assignment)
- INSERT/UPDATE: usuario autenticado pode operar na sua empresa
- DELETE: restrito a service_role
- Realtime habilitado para `cs_customers` e `cs_incidents`

---

## Bloco 2: Tipos e Hooks (Frontend)

### 2.1 `src/types/customerSuccess.ts`
Tipos TypeScript para todas as 5 tabelas CS, enums de health status, tipos de survey, gravidade de incidencias, etc.

### 2.2 `src/hooks/useCSCustomers.ts`
Hook com React Query para listar, buscar por ID, e atualizar clientes CS. Inclui filtros por empresa, health_status, nps_categoria, csm_id. Suporte a `.range()` para paginacao server-side.

### 2.3 `src/hooks/useCSSurveys.ts`
Hook para listar pesquisas, criar nova pesquisa (envio manual), e registrar resposta.

### 2.4 `src/hooks/useCSIncidents.ts`
Hook para CRUD de incidencias: criar, listar, atualizar status, resolver.

### 2.5 `src/hooks/useCSHealthLog.ts`
Hook para consultar historico de health score de um cliente.

### 2.6 `src/hooks/useCSMetrics.ts`
Hook para KPIs do dashboard: total clientes, health medio, NPS medio, clientes em risco, renovacoes proximas, churn rate.

---

## Bloco 3: Telas do Modulo

### 3.1 Dashboard CS (`/cs`)
Pagina principal do CSM com:
- 6 KPIs no topo: Clientes Ativos, Health Score Medio (gauge), NPS Medio, Clientes em Risco, Renovacoes 30 dias, Churn Rate
- Secoes: Alertas Criticos, Renovacoes Iminentes, NPS Recentes, Incidencias Abertas
- Graficos: Health Trend (linha 6 meses), Distribuicao de Health (donut)

### 3.2 Lista de Clientes CS (`/cs/clientes`)
Tabela com todos os clientes CS. Colunas: Nome, Empresa, CSM, Health Score (badge colorido), NPS, CSAT, Ultimo contato, Proxima renovacao, Valor MRR, Tags.
Filtros: empresa, health status, NPS categoria, CSM, busca por nome/email.
Paginacao server-side com `.range()`.

### 3.3 Detalhe do Cliente CS (`/cs/clientes/:id`)
Layout: Sidebar esquerda (dados + health gauge + breakdown 6 dimensoes + NPS/CSAT badges + tags) + Area principal com tabs:
- **Visao Geral**: Timeline de interacoes com badges de tipo e sentimento
- **Pesquisas**: Historico NPS/CSAT/CES com graficos de trend. Botao "Enviar NPS agora"
- **Incidencias**: Lista com status/gravidade/responsavel. Botao "Nova incidencia"
- **Deals**: Deals associados (ganhos, perdidos, em andamento)
- **Renovacao**: Proxima data, valor, historico de renovacoes
- **Health Log**: Historico com explicacao IA para cada mudanca

### 3.4 Pesquisas (`/cs/pesquisas`)
Central de pesquisas com sub-tabs: Pendentes, Respondidas, Configuracao.
Dashboard com NPS over time e distribuicao promotores/neutros/detratores.

### 3.5 Incidencias (`/cs/incidencias`)
Lista filtravel por empresa, gravidade, status, responsavel.
SLA visual por gravidade.

---

## Bloco 4: Edge Function -- Health Score Calculator

### 4.1 `cs-health-calculator`
Edge function que calcula o health score de um cliente baseado em 6 dimensoes ponderadas:

| Dimensao | Peso | Fonte |
|----------|------|-------|
| NPS | 20% | Ultimo NPS em cs_surveys |
| CSAT | 15% | Media ultimos 3 CSATs |
| Engajamento | 20% | Contagem de interacoes (msgs, calls, atividades) nos ultimos 30 dias |
| Financeiro | 20% | Status dos deals (ganho/pago/atrasado) |
| Tempo | 10% | Tempo desde primeiro deal ganho |
| Sentimento | 15% | Score de sentimento das ultimas mensagens |

- Recebe `customer_id` (individual) ou executa para todos (cron)
- Compara com score anterior e salva em `cs_health_log` se mudou
- Atualiza `health_score` e `health_status` em `cs_customers`
- Se cruzou threshold (ex: 60 para 59), cria notificacao para o CSM

---

## Bloco 5: Navegacao e Permissoes

### 5.1 Screen Registry
Registrar 5 novas telas no `screenRegistry.ts`:
- `cs_dashboard`, `cs_clientes`, `cs_pesquisas`, `cs_incidencias`, `cs_playbooks`

### 5.2 Sidebar
Adicionar novo grupo "Sucesso do Cliente" na sidebar com as telas CS, usando icones apropriados (HeartPulse, Users, ClipboardList, AlertCircle).

### 5.3 Rotas
5 novas rotas protegidas em `App.tsx`:
- `/cs` -> CSDashboardPage
- `/cs/clientes` -> CSClientesPage
- `/cs/clientes/:id` -> CSClienteDetailPage
- `/cs/pesquisas` -> CSPesquisasPage
- `/cs/incidencias` -> CSIncidenciasPage

### 5.4 Perfis de Acesso
O sistema de perfis de acesso granular (`access_profiles`) ja suporta novas telas automaticamente -- basta registra-las no registry. Administradores configuram quem ve o que.

---

## Bloco 6: Copilot Enriquecido com Dados CS

### 6.1 `enrichCustomerContext()`
Nova funcao no `copilot-chat` edge function que, quando o contexto e de um cliente (is_cliente=true), busca:
- Health score, status, breakdown das 6 dimensoes
- Ultimos NPS/CSAT
- Incidencias abertas
- Proxima renovacao e valor
- Sentimento recente

Isso permite perguntas como: "Qual a situacao do Carlos?" e a Amelia responde com contexto CS completo.

---

## Resumo de Entregas

| Item | Tipo | Quantidade |
|------|------|-----------|
| Tabelas novas | Migration | 5 (cs_customers, cs_surveys, cs_incidents, cs_health_log, cs_playbooks) |
| Trigger | Migration | 1 (deal GANHO -> cs_customers) |
| Politicas RLS | Migration | ~15 |
| Tipos TypeScript | Novo arquivo | 1 |
| Hooks React Query | Novos arquivos | 6 |
| Paginas/Componentes | Novos arquivos | ~15 |
| Edge Function | Nova | 1 (cs-health-calculator) |
| Screen Registry | Update | 5 telas |
| Sidebar | Update | 1 grupo novo |
| Rotas App.tsx | Update | 5 rotas |
| Copilot | Update | 1 funcao enrichCustomerContext |

---

## Ordem de Execucao

1. **Migration SQL** -- tabelas, RLS, trigger, realtime
2. **Tipos + Hooks** -- foundation do frontend
3. **Dashboard CS** -- primeira tela visivel
4. **Lista de Clientes** -- navegacao e filtros
5. **Detalhe do Cliente** -- tela principal com tabs
6. **Pesquisas e Incidencias** -- telas secundarias
7. **Edge Function Health Calculator** -- calculo de score
8. **Navegacao** -- sidebar, registry, rotas
9. **Copilot CS** -- enriquecimento de contexto

---

## Detalhes Tecnicos da Migration

```text
-- Tabelas:
cs_customers (24 colunas, FK contacts + profiles, empresa_tipo enum)
cs_surveys (15 colunas, FK cs_customers)
cs_incidents (16 colunas, FK cs_customers + profiles)
cs_health_log (7 colunas, FK cs_customers)
cs_playbooks (9 colunas, empresa_tipo enum)

-- Trigger:
trg_deal_ganho_to_cs_customer
  AFTER UPDATE ON deals
  WHEN (NEW.status = 'GANHO' AND OLD.status != 'GANHO')
  -> Cria/atualiza cs_customers com contact_id, empresa, data_primeiro_ganho, valor_mrr

-- Realtime:
ALTER PUBLICATION supabase_realtime ADD TABLE cs_customers;
ALTER PUBLICATION supabase_realtime ADD TABLE cs_incidents;

-- RLS:
Todas as tabelas com enable row level security
SELECT filtrado por get_user_empresa(auth.uid())
INSERT/UPDATE restrito a empresa do usuario
DELETE restrito a service_role
```

## O Que Fica Para Fase 2

- NPS automatico via cadencia (90 dias apos deal ganho)
- Deteccao automatica de incidencias por sentimento negativo
- Briefing diario do CSM via edge function
- Alertas de renovacao proativos (60/30/15 dias)
- Playbooks CS pre-definidos ativados por triggers
- Health score recalculado em realtime por eventos
