
# Correcao: Clique em "Proximo Passo" gera 404

## Causa Raiz

A rota de detalhe do lead exige dois parametros: `/leads/:leadId/:empresa`. Porem, o `NextBestActionCard` navega para `/leads/${acao.lead_id}` sem incluir a empresa, resultando em 404.

## Solucao

### Alteracao 1: `src/components/workbench/NextBestActionCard.tsx`

No `handleClick`, quando a acao tem `lead_id`, incluir a empresa ativa na navegacao:

```
// Antes:
if (acao.lead_id) navigate(`/leads/${acao.lead_id}`);

// Depois:
if (acao.lead_id) navigate(`/leads/${acao.lead_id}/${activeCompany ?? 'BLUE'}`);
```

Importar `useCompany` e extrair `activeCompany` no componente.

### Alteracao 2 (seguranca extra): Tratar `activeCompany === 'ALL'`

Se a empresa ativa for `ALL`, usar a empresa do lead (se disponivel na resposta da edge function) ou um fallback como `'BLUE'`.

## Arquivos editados

1. `src/components/workbench/NextBestActionCard.tsx` -- adicionar `useCompany`, incluir empresa na rota de navegacao
