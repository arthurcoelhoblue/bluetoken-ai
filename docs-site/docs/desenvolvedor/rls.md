---
sidebar_position: 3
title: RLS e Segurança
---

# Políticas RLS e Segurança

O Amélia CRM usa **Row Level Security (RLS)** do PostgreSQL para controle de acesso granular.

## Princípios

1. **Todas as tabelas têm RLS habilitado**
2. **Isolamento por tenant** — Filtro por `empresa` via `get_user_empresa(auth.uid())`
3. **Isolamento por usuário** — Vendedores veem apenas seus próprios dados
4. **Menor privilégio** — Cada perfil tem apenas as permissões necessárias

## Padrão de Política

```sql
-- Exemplo: usuário vê apenas seus deals
CREATE POLICY "Users see own deals"
ON public.deals
FOR SELECT
USING (
  owner_id = auth.uid()
  AND empresa = get_user_empresa(auth.uid())
);
```

## Tabelas Críticas com RLS Hardened

- `deals` — Filtro por `owner_id` + `empresa`
- `contacts` — Filtro por `owner_id` + `empresa`
- `organizations` — Filtro por `empresa`
- `profiles` — Visibilidade restrita a colegas da mesma org
- `deal_activities` — Filtro por empresa via deal

## Views SECURITY INVOKER

Views analíticas foram convertidas para `SECURITY INVOKER` para respeitar permissões do usuário:

- `analytics_evolucao_mensal`
- `analytics_funil_visual`
- `analytics_ltv_cohort`
- `seller_leaderboard`

:::warning Nunca use SECURITY DEFINER para views analíticas
Views `SECURITY DEFINER` bypassam RLS, podendo expor dados entre tenants.
:::
