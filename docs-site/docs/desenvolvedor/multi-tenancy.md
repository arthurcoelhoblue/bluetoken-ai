---
sidebar_position: 4
title: Multi-tenancy
---

# Multi-tenancy — Schema Views

## Arquitetura

O isolamento multi-tenant usa **Schema Views** ao invés de bancos separados:

```
public (schema)     → Tabelas reais com todos os dados
blue (schema)       → ~57 views filtradas por empresa='BLUE'
tokeniza (schema)   → ~57 views filtradas por empresa='TOKENIZA'
```

## Função de Provisionamento

```sql
SELECT public.provision_tenant_schema('novo_tenant');
```

Esta função:
1. Cria o schema se não existir
2. Gera views `SECURITY INVOKER` para cada tabela
3. Filtra por `empresa` (direto ou via JOINs para tabelas como `pipeline_stages`)
4. Concede permissões adequadas

## Características das Views

- **SECURITY INVOKER** — Respeita RLS do usuário chamador
- **Filtro automático** — Todas filtram por `empresa`
- **Read-only** — Views são para consulta; writes vão direto no `public`
- **~57 views por tenant** — Cobertura completa das tabelas

## Frontend

O frontend continua usando o schema `public` normalmente. As views de tenant são para consultas analíticas e relatórios isolados.
