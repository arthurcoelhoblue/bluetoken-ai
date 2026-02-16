

# Busca SGT na Tela de Leads + Sync Diaria de Clientes (06h BRT)

## Resumo da alteracao

O plano original foi aprovado com uma unica mudanca: o CRON job de sincronizacao com o SGT rodara **uma vez por dia as 06:00 BRT (09:00 UTC)** em vez de a cada 30 minutos.

## Implementacao

### 1. Componente Frontend: `src/components/leads/SGTLeadSearchCard.tsx` (Novo)

Card na tela de Leads com:
- Toggle entre busca por Email ou Telefone
- Campo de input + botao "Buscar"
- Exibicao dos resultados retornados pelo SGT
- Estados de loading e "nao encontrado"
- Usa o hook `useSGTLeadSearch` ja existente

### 2. Integracao na Tela de Leads: `src/pages/LeadsList.tsx` (Alterar)

- Adicionar o `SGTLeadSearchCard` acima da tabela principal

### 3. Nova Edge Function: `supabase/functions/sgt-sync-clientes/index.ts` (Novo)

Funcao que:
1. Busca contatos com `is_cliente = false` que tenham email ou telefone
2. Em lotes, consulta a API do SGT para cada contato
3. Se o SGT indicar que e cliente: atualiza `contacts.is_cliente = true` e cria registro em `cs_customers`

### 4. Registro em `supabase/config.toml` (Alterar)

Adicionar `sgt-sync-clientes` com `verify_jwt = false`

### 5. CRON Job (Migracao SQL)

Agendar execucao diaria as 06:00 BRT = 09:00 UTC:

```sql
SELECT cron.schedule(
  'sgt-sync-clientes',
  '0 9 * * *',
  $$ ... $$
);
```

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/leads/SGTLeadSearchCard.tsx` | Novo |
| `src/pages/LeadsList.tsx` | Alterar |
| `supabase/functions/sgt-sync-clientes/index.ts` | Novo |
| `supabase/config.toml` | Alterar |
| Migracao SQL (CRON) | Nova |

