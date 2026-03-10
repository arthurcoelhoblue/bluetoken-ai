

# Arquivar conversas ao ganhar/perder negócio

## Diagnóstico

A lógica de filtro já existe e funciona corretamente — conversas de leads com deals fechados (GANHO/PERDIDO) são ocultadas da aba Conversas. O problema é de **cache**: quando o vendedor fecha um deal, apenas a query `['deals']` é invalidada. A query `['atendimentos']` (que alimenta a página Conversas) não é invalidada, e só atualiza no auto-refresh de 60 segundos.

## Correção

Arquivo: `src/hooks/deals/useDealMutations.ts`

Adicionar invalidação de `['atendimentos']` no `onSuccess` do `useCloseDeal` (linha 103):

```typescript
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ['deals'] });
  qc.invalidateQueries({ queryKey: ['atendimentos'] });
},
```

Isso garante que, ao fechar um deal como GANHO ou PERDIDO, a lista de conversas é imediatamente atualizada e a conversa desaparece.

## Impacto
- Nenhuma mudança de banco de dados necessária
- Nenhuma mudança de lógica de filtro — já funciona
- Apenas 1 linha adicionada para sincronizar o cache

