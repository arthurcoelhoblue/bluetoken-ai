
## Patch 8: Relatorios e Analytics

### Resumo

Dashboard analitico completo com 6 KPIs, 4 tabs (Funil, Vendedores, Canais, Perdas), filtro por pipeline, e Copilot integrado. Alimentado por 6 views SQL otimizadas.

---

### Adaptacoes vs PDF (problemas encontrados no schema real)

| PDF assume | Schema real | Correcao |
|------------|------------|----------|
| `deal_stage_history.tempo_no_stage_anterior_min` | `tempo_no_stage_anterior_ms` (milissegundos) | Converter `ms / 60000` para obter minutos |
| `pipeline_stages.is_active` | Coluna nao existe | Remover filtro (todos stages ativos por padrao) |
| `pipelines.is_active` | `pipelines.ativo` | Usar `p.ativo = true` |
| `deals.empresa` (em analytics_vendedor) | Nao existe no deals | Fazer JOIN com pipelines para obter empresa |
| `analytics_conversion.ticket_medio_ganho` / `ciclo_medio_dias` | PDF corta SQL na pagina 3 | Completar calculo baseado na logica descrita |

---

### Ordem de implementacao

#### Fase 1: Migration SQL — 6 Views Analytics

Criar 6 views com as correcoes acima:

1. **analytics_funnel** — Deals por stage em cada pipeline (deals_count, deals_valor, tempo_medio_min, deals_ativos)
2. **analytics_conversion** — Taxas por pipeline (total_deals, win_rate, ticket_medio_ganho, ciclo_medio_dias)
3. **analytics_vendedor** — Performance individual (deals_ganhos, valor_ganho, win_rate, atividades_7d). JOIN com pipelines para empresa
4. **analytics_deals_periodo** — Deals agrupados por mes
5. **analytics_motivos_perda** — Top motivos rankeados com quantidade e valor
6. **analytics_canal_origem** — Performance por canal de origem

Todas as views usam `SECURITY INVOKER` para respeitar RLS.

#### Fase 2: Types — `src/types/analytics.ts`

6 interfaces conforme PDF:
- AnalyticsFunnel, AnalyticsConversion, AnalyticsVendedor
- AnalyticsPeriodo, AnalyticsMotivosPerda, AnalyticsCanalOrigem

#### Fase 3: Hooks — `src/hooks/useAnalytics.ts`

6 hooks (1 por view), cada um filtrando por empresa via `useCompany()`. useAnalyticsFunnel aceita `pipelineId` opcional.

#### Fase 4: Page — `src/pages/AnalyticsPage.tsx`

Dashboard completo com:
- Header: titulo + filtro por pipeline + botao Copilot Amelia
- 6 KPIs cards no topo (Total deals, Win rate, Valor ganho, Pipeline aberto, Ticket medio, Ciclo medio)
- 4 Tabs:
  - **Funil**: barras horizontais por stage com deals, valor, tempo medio
  - **Vendedores**: tabela ranking com ganhos, perdidos, abertos, valor, win rate, atividades 7d
  - **Canais**: tabela com total, ganhos, perdidos, valor ganho, win rate
  - **Perdas**: motivos rankeados com quantidade e valor perdido

#### Fase 5: Routing e Sidebar

- Rota `/relatorios` em App.tsx com `requiredRoles={['ADMIN', 'CLOSER']}`
- Item "Relatorios" no grupo "Comercial" do AppSidebar com icone BarChart3
- Registro em screenRegistry.ts

---

### Secao tecnica

**Arquivos criados/modificados**:

| Arquivo | Acao |
|---------|------|
| Migration SQL (6 views) | Criar via migration tool |
| `src/types/analytics.ts` | Criar |
| `src/hooks/useAnalytics.ts` | Criar |
| `src/pages/AnalyticsPage.tsx` | Criar |
| `src/App.tsx` | Editar (adicionar rota) |
| `src/components/layout/AppSidebar.tsx` | Editar (adicionar item) |
| `src/config/screenRegistry.ts` | Editar (registrar tela) |

**Correcao critica no SQL**: `tempo_no_stage_anterior_ms / 60000.0` em vez de referenciar coluna inexistente `_min`.

**Dependencias satisfeitas**: pipelines, deals, pipeline_stages, deal_stage_history, deal_activities, profiles, contacts — todas existem.

---

### Checklist de validacao (sera executado apos implementacao)

1. 6 views analytics criadas (SELECT * FROM analytics_conversion LIMIT 5)
2. Verificar dados reais nas views
3. Rota /relatorios acessivel
4. Item "Relatorios" visivel na sidebar grupo Comercial
5. KPIs renderizam corretamente
6. Tab Funil mostra stages com barras
7. Tab Vendedores mostra ranking em tabela
8. Tab Canais mostra performance por canal
9. Tab Perdas mostra motivos rankeados
10. Filtro por pipeline atualiza todos os dados
11. Company switcher filtra por empresa
12. Copilot Amelia acessivel no header da pagina
