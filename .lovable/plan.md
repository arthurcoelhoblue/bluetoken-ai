

## Problema

Ao clicar num card no pipeline, abre o `LeadLookupDialog` (verificação de lead) antes de mostrar o deal. O usuário quer ir direto para o `DealDetailSheet`, já que o chat está disponível dentro do cadastro do deal.

## Solução

Em `src/pages/PipelinePage.tsx`, simplificar o `handleDealClick` para abrir o `DealDetailSheet` diretamente, sem passar pelo `LeadLookupDialog`:

```tsx
const handleDealClick = (dealId: string) => {
  setSelectedDealId(dealId);
};
```

Remover todo o código relacionado ao lookup:
- Estados `lookupDealId`, `showLookup`
- O componente `<LeadLookupDialog>` do JSX
- O import de `LeadLookupDialog`

| Arquivo | Mudança |
|---------|---------|
| `src/pages/PipelinePage.tsx` | Simplificar `handleDealClick`, remover `LeadLookupDialog` e estados associados |

