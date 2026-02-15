

# Filtro Multi-empresa nos Leads Quentes

## Problema

O hook `useLeadsQuentes` busca dados de `lead_message_intents` e `lead_classifications` sem filtrar pela empresa ativa no `CompanyContext`. Isso faz com que um usuario vendo "BLUE" veja tambem leads da "TOKENIZA" e vice-versa.

## Solucao

Modificar `useLeadsQuentes` para receber o `activeCompany` do `CompanyContext` e aplicar filtro `.eq("empresa", activeCompany)` em todas as queries (quando nao for "ALL").

### Mudancas

**1. `src/hooks/useLeadsQuentes.ts`**
- Aceitar parametro `empresa: ActiveCompany`
- Adicionar `queryKey: ["leads-quentes", empresa]` para invalidar cache ao trocar empresa
- Em cada query (`lead_message_intents`, `lead_classifications`, `lead_contacts`, `lead_conversation_state`), aplicar `.eq("empresa", empresa)` quando `empresa !== "ALL"`

**2. `src/components/dashboard/LeadsQuentesCard.tsx`**
- Importar `useCompany` e passar `activeCompany` para `useLeadsQuentes`

**3. `src/pages/admin/LeadsQuentes.tsx`**
- Importar `useCompany` e passar `activeCompany` para `useLeadsQuentes`
- Remover os filtros manuais "TOKENIZA" e "BLUE" da lista de badges (ja que o filtro global cuida disso), ou mante-los como filtro adicional dentro do contexto

**4. `src/pages/AmeliaPage.tsx`**
- Nenhuma mudanca necessaria pois usa `LeadsQuentesCard` que ja tera o filtro

### Detalhe tecnico

```typescript
// useLeadsQuentes.ts
import { useCompany, ActiveCompany } from "@/contexts/CompanyContext";

export function useLeadsQuentes() {
  const { activeCompany } = useCompany();
  
  return useQuery({
    queryKey: ["leads-quentes", activeCompany],
    queryFn: async () => {
      let intentsQuery = supabase
        .from("lead_message_intents")
        .select(...)
        .in("acao_recomendada", [...])
        .eq("acao_aplicada", false);
      
      if (activeCompany !== "ALL") {
        intentsQuery = intentsQuery.eq("empresa", activeCompany);
      }
      // Mesmo padrao para lead_classifications, lead_contacts, etc.
    }
  });
}
```

