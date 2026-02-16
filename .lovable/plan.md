
# Conexao com API de Busca de Leads do SGT

## Objetivo

Criar uma edge function no projeto que atua como proxy para consultar a API do SGT (`buscar-lead-api`), permitindo buscar dados de leads por email ou telefone. Essa funcao podera ser chamada pelo frontend para enriquecer dados ou validar leads.

## Arquitetura

```text
Frontend (hook)
     |
     v
Edge Function: sgt-buscar-lead (nosso projeto)
     |  POST com x-api-key
     v
SGT API: buscar-lead-api (Supabase externo)
     |
     v
Retorna dados do lead
```

## Implementacao

### 1. Atualizar o secret `SGT_WEBHOOK_SECRET`

O secret ja existe, mas o valor precisa ser atualizado para: `JIKLSFhofjhalosfSA7W8PR9UFEAUOJIF54702a` (valor fornecido pelo usuario). Sera usado tanto para autenticar webhooks de entrada quanto para chamadas de saida ao SGT.

### 2. Nova Edge Function: `supabase/functions/sgt-buscar-lead/index.ts`

Funcao serverless que:
- Recebe POST com `{ email }` ou `{ telefone }` do frontend
- Valida autenticacao do usuario (JWT do Supabase)
- Faz a chamada ao endpoint externo do SGT: `https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/buscar-lead-api`
- Envia header `x-api-key` com o valor de `SGT_WEBHOOK_SECRET`
- Retorna os dados do lead encontrado

Estrutura:
```text
supabase/functions/sgt-buscar-lead/
  index.ts      # Logica principal
```

Logica resumida:
- Validar que o request tem JWT valido (usuario autenticado)
- Extrair `email` ou `telefone` do body
- Chamar a API externa do SGT com `fetch()`
- Retornar a resposta ao frontend

### 3. Novo Hook Frontend: `src/hooks/useSGTLeadSearch.ts`

Hook React Query que:
- Exporta funcao `searchLead({ email?, telefone? })`
- Chama a edge function `sgt-buscar-lead` via `supabase.functions.invoke()`
- Retorna dados do lead, loading state e erro
- Usara `useMutation` do TanStack Query (busca sob demanda, nao automatica)

### 4. Integracao opcional com UI existente

O hook ficara disponivel para ser integrado em qualquer tela (ex: LeadDetail, lista de leads, formulario de contato). A integracao com UI especifica pode ser feita em um proximo passo.

## Arquivos criados/alterados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/sgt-buscar-lead/index.ts` | **Novo** - Edge function proxy |
| `src/hooks/useSGTLeadSearch.ts` | **Novo** - Hook para busca de leads |
| Secret `SGT_WEBHOOK_SECRET` | **Atualizar** valor |

## Seguranca

- A edge function exige JWT valido (usuario logado) para ser chamada
- O secret `SGT_WEBHOOK_SECRET` nunca e exposto ao frontend
- A URL do SGT externo fica apenas no backend
