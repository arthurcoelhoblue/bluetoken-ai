

# Plano Consolidado: Paineis Comerciais + Sazonalidade + Motivos de Perda

Este plano unifica as duas frentes: paineis comerciais inteligentes (Cockpit NB/Renovacao, Analise de Esforco, Alertas) E sazonalidade nas metas + CRUD de motivos de perda.

---

## Concluído ✅

- Tabela `sazonalidade_indices` criada com seed (BLUE + TOKENIZA)
- RLS configurada na tabela + em `deal_loss_categories`
- Hooks: `useSazonalidade`, `useUpdateSazonalidade`, `useUpsertMetasBatch`
- Hooks CRUD para loss categories
- Componentes: `LossCategoriesConfig`, `ComercialTab`, `MetaAnualDialog`
- Tab "Comercial" adicionada em Settings
- Botao "Meta Anual" em MetasPage
- Views SQL: `analytics_esforco_vendedor` + `analytics_canal_esforco` (SECURITY INVOKER)
- Tipos TS: `AnalyticsEsforcoVendedor`, `AnalyticsCanalEsforco`
- Hooks: `useAnalyticsEsforco()`, `useAnalyticsCanalEsforco()`
- Componente `CriticalAlerts.tsx` no Cockpit (deals sem atividade 24h, inconsistências, sem owner)
- Tab "Esforço" em Relatórios com `EsforcoVendedorTable` (semáforo) e `EsforcoCanalTable` (badge CRÍTICO)
- Página Renovação reescrita com dashboard funcional (KPIs, motivos, ranking por vendedor)
