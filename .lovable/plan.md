

# Plano Consolidado: Paineis Comerciais + Sazonalidade + Motivos de Perda

Este plano unifica as duas frentes que foram discutidas: os paineis comerciais inteligentes (Cockpit NB/Renovacao, Analise de Esforco, Alertas) E a sazonalidade nas metas + CRUD de motivos de perda (ja parcialmente implementado).

---

## O que ja foi feito

- Tabela `sazonalidade_indices` criada com seed (BLUE + TOKENIZA)
- RLS configurada na tabela + em `deal_loss_categories`
- Hooks: `useSazonalidade`, `useUpdateSazonalidade`, `useUpsertMetasBatch`
- Hooks CRUD para loss categories
- Componentes: `LossCategoriesConfig`, `ComercialTab`, `MetaAnualDialog`
- Tab "Comercial" adicionada em Settings
- Botao "Meta Anual" em MetasPage

---

## O que falta implementar

### Fase 1 -- Views SQL de Esforco (Migracao)

Criar duas views SQL que analisam o esforco de vendedores e canais em deals perdidos. Usam dados ja existentes (deals, deal_activities, pipelines, profiles).

**View `analytics_esforco_vendedor`**:
- Conta atividades por deal perdido
- Calcula: total perdidos, media de atividades, % sem nenhuma atividade, media de dias no funil, perdidos em menos de 24h
- Agrupado por vendedor + empresa
- Usa `SECURITY INVOKER`

**View `analytics_canal_esforco`**:
- Mesmas metricas de esforco mas agrupadas por canal de origem
- Inclui win_rate e valor ganho para contexto
- Flags automaticos para canais criticos (>40% sem atividade)

### Fase 2 -- Cockpit Executivo Enriquecido

Separar o Cockpit em blocos visuais de New Business vs Renovacao:

- **KPIs separados**: O seletor de pipeline passa a ter opcoes "NB" e "Renovacao" alem de "Todos"
- **Alertas Criticos**: Novo componente `CriticalAlerts.tsx` mostrando:
  - Deals ativos sem atividade ha mais de 24h
  - Deals marcados "esgotado" com menos de 3 atividades (inconsistencia)
  - Leads sem proprietario (owner_id IS NULL)
- Posicionado logo abaixo dos KPIs, antes do funil

### Fase 3 -- Pagina de Renovacao

Substituir o shell atual por um dashboard funcional:

- **KPIs de Renovacao**: Renovacoes enviadas, convertidas, taxa de conversao, receita renovada
- **Motivos de Nao Renovacao**: Grafico de barras horizontais com top motivos
- **Performance por Vendedor (Renovacao)**: Tabela rankeada por conversao
- Filtra automaticamente pelo pipeline de tipo renovacao (quando existir)
- Se nao existir pipeline de renovacao, mostra estado vazio orientando a criacao

### Fase 4 -- Tab "Esforco" nos Relatorios

Adicionar nova tab na pagina de Relatorios (`AnalyticsPage.tsx`):

- **Tabela de Esforco por Vendedor**: Com semaforo visual
  - Verde: media acima de 5 atividades nos perdidos
  - Amarelo: entre 3 e 5
  - Vermelho: abaixo de 3
  - Destaque para vendedores com mais de 20% de deals sem atividade
- **Tabela de Esforco por Canal**: Enriquece a analise existente
  - Badge "CRITICO" para canais com menos de 5% conversao e mais de 30% sem atividade

---

## Detalhes Tecnicos

### Migracao SQL

Uma unica migracao com as duas views:

```text
View analytics_esforco_vendedor:
  SELECT 
    pr.id AS user_id, pr.nome AS vendedor_nome, pip.empresa,
    count(d.id) AS total_perdidos,
    avg(ativ_count) AS media_atividades,
    % com 0 atividades AS sem_atividade_pct,
    avg(dias entre created_at e data_perda) AS media_dias_funil,
    count onde (data_perda - created_at) < 1 dia AS perdidos_menos_24h
  FROM deals d 
    JOIN pipelines pip ...
    JOIN profiles pr ...
    LEFT JOIN (subquery contando atividades por deal) ...
  WHERE d.status = 'perdido'
  GROUP BY pr.id, pr.nome, pip.empresa

View analytics_canal_esforco:
  Mesma logica mas GROUP BY d.canal_origem, pip.empresa, d.pipeline_id
  Inclui tambem deals_ganhos, valor_ganho, win_rate
```

### Tipos TypeScript

Novos tipos em `src/types/analytics.ts`:

```text
AnalyticsEsforcoVendedor {
  user_id, vendedor_nome, empresa,
  total_perdidos, media_atividades, sem_atividade_pct,
  media_dias_funil, perdidos_menos_24h
}

AnalyticsCanalEsforco {
  canal, empresa, pipeline_id,
  total_deals, deals_ganhos, deals_perdidos,
  valor_ganho, win_rate,
  media_atividades_perdidos, sem_atividade_pct, 
  media_dias_funil_perdidos
}
```

### Hooks

Em `src/hooks/useAnalytics.ts`:
- `useAnalyticsEsforco()` -- query na view analytics_esforco_vendedor
- `useAnalyticsCanalEsforco(pipelineId?)` -- query na view analytics_canal_esforco

### Componentes Novos

| Componente | Descricao |
|------------|-----------|
| `src/components/cockpit/CriticalAlerts.tsx` | Card de alertas inteligentes (deals sem atividade, inconsistencias) |
| `src/components/analytics/EsforcoVendedorTable.tsx` | Tabela com semaforo de esforco por vendedor |
| `src/components/analytics/EsforcoCanalTable.tsx` | Tabela de esforco por canal com badges criticos |

### Arquivos Editados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/CockpitPage.tsx` | Adicionar CriticalAlerts abaixo dos KPIs |
| `src/pages/RenovacaoPage.tsx` | Reescrever com dashboard funcional usando hooks existentes |
| `src/pages/AnalyticsPage.tsx` | Nova tab "Esforco" com as duas tabelas |
| `src/hooks/useAnalytics.ts` | Adicionar useAnalyticsEsforco + useAnalyticsCanalEsforco |
| `src/types/analytics.ts` | Adicionar tipos Esforco |

### Sem Necessidade

- Nenhuma dependencia JS nova
- Nao cria dados -- tudo sao views SQL sobre dados existentes
- As views usam SECURITY INVOKER para respeitar RLS
- Pipeline de renovacao nao sera criado automaticamente -- a pagina se adapta

