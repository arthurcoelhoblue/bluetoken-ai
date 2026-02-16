---
sidebar_position: 9
title: Multi-tenancy
---

# Multi-tenancy — Schemas e Isolamento

O Amélia CRM opera em modelo multi-tenant com isolamento por **Schema Views**.

## Arquitetura

- **Schema `public`** — Tabelas originais com todos os dados
- **Schema `blue`** — Views filtradas para empresa BLUE
- **Schema `tokeniza`** — Views filtradas para empresa TOKENIZA

## Como Funciona

Cada schema tenant contém **views** (não tabelas) que filtram automaticamente os dados pela coluna `empresa`. As views são do tipo `SECURITY INVOKER`, garantindo que as políticas RLS do usuário sejam respeitadas.

## Provisionamento

A função `public.provision_tenant_schema(tenant_empresa TEXT)` gera automaticamente todas as views para um novo tenant:

```sql
SELECT public.provision_tenant_schema('novo_tenant');
```

Isso cria ~57 views no schema correspondente, cobrindo todas as tabelas com filtro de empresa.

:::warning Isolamento
Os dados entre tenants são completamente isolados. Um usuário BLUE nunca acessa dados TOKENIZA, mesmo em caso de falha nos filtros de aplicação.
:::
