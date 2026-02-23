

# Corrigir campo "Proxima execucao" da cadencia

## Problema

O campo "Proxima execucao" na pagina LeadDetail mostra o valor `next_run_at` da tabela `lead_cadence_runs`, mas apresenta dois problemas:

1. **Valor desatualizado**: apos o `cadence-runner` processar o step e atualizar `next_run_at` no banco, a tela nao refaz a query automaticamente -- o usuario continua vendo o horario antigo ate recarregar a pagina.
2. **Horario no passado**: quando `next_run_at` ja passou mas o runner ainda nao processou (ele roda a cada 15 min via cron), o campo exibe um horario no passado sem nenhuma indicacao visual, parecendo um bug.

## Solucao

### 1. Auto-refresh periodico no hook `useLeadDetail`

Adicionar `refetchInterval` na query `cadenceRunQuery` para que ela atualize automaticamente a cada 30 segundos enquanto a cadencia estiver ativa:

**Arquivo**: `src/hooks/useLeadDetail.ts`

Na query `cadenceRunQuery`, adicionar:

```typescript
refetchInterval: 30_000, // refetch a cada 30s
```

Isso garante que apos o runner processar, a tela atualiza em no maximo 30 segundos.

### 2. Indicacao visual quando horario ja passou

**Arquivo**: `src/pages/LeadDetail.tsx` (linhas 343-352)

Alterar a renderizacao do campo para verificar se `next_run_at` esta no passado:

- Se `next_run_at` esta no **futuro**: exibir normalmente com `format()` e usar `formatDistanceToNow` como complemento (ex: "23/02 as 18:00 (em 15 min)")
- Se `next_run_at` esta no **passado**: exibir "Processando..." ou "Aguardando execucao" com um indicador visual (spinner ou texto em cor diferente), sinalizando que o runner ainda nao processou

Exemplo de logica:

```typescript
const nextRunDate = new Date(cadenceRun.next_run_at);
const isPast = nextRunDate < new Date();

{isPast ? (
  <p className="font-medium text-muted-foreground flex items-center gap-1">
    <Loader2 className="h-3 w-3 animate-spin" />
    Aguardando execucao...
  </p>
) : (
  <p className="font-medium">
    {format(nextRunDate, "dd/MM 'as' HH:mm", { locale: ptBR })}
    <span className="text-muted-foreground text-xs ml-1">
      ({formatDistanceToNow(nextRunDate, { addSuffix: true, locale: ptBR })})
    </span>
  </p>
)}
```

## Arquivos alterados

- `src/hooks/useLeadDetail.ts` -- adicionar `refetchInterval: 30_000` na cadenceRunQuery
- `src/pages/LeadDetail.tsx` -- logica de exibicao com tratamento de horario passado

## Resultado esperado

- O campo atualiza automaticamente a cada 30 segundos
- Quando o horario ja passou, exibe "Aguardando execucao..." com spinner em vez de um horario no passado
- Quando o horario e futuro, exibe a data formatada com distancia relativa ("em 15 min")

