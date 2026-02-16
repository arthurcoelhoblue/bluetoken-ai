---
sidebar_position: 10
title: FAQ do Admin
---

# FAQ do Administrador

### O custo da IA subiu inesperadamente. O que verificar?

1. Acesse **Custos IA** e identifique qual função está consumindo mais
2. Verifique se há loops ou erros gerando chamadas repetidas
3. Use o **Benchmark** para testar modelos mais econômicos

### Como adicionar um novo tenant?

Execute a função de provisionamento no banco de dados:
```sql
SELECT public.provision_tenant_schema('nome_do_tenant');
```

### As integrações estão falhando. O que fazer?

Acesse **Saúde Operacional** para ver o status detalhado de cada integração. O sistema registra as últimas falhas com timestamps e mensagens de erro.
