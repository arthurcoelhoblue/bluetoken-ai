
# Corrigir card "Proximo Passo" invisivel no Meu Dia

## Diagnostico

O card **"Proximo Passo"** (NextBestActionCard) esta presente no codigo da pagina Meu Dia (WorkbenchPage.tsx, linha 124), e a edge function `next-best-action` funciona corretamente (testada com sucesso, retorna acoes e narrativa).

O problema esta no componente `NextBestActionCard.tsx`, linha que diz:

```
if (isError) return null;
```

Quando a chamada a edge function falha (por timeout, token expirado, ou qualquer erro de rede), o card **desaparece silenciosamente** sem nenhum feedback ao usuario. Isso acontece porque o React Query marca a query como `isError` e o componente retorna `null`.

## Solucao

Substituir o `return null` por um estado de erro visivel com botao de retry, mantendo o card na tela para que o usuario saiba que a funcionalidade existe e pode tentar novamente.

## Detalhes tecnicos

**Arquivo modificado**: `src/components/workbench/NextBestActionCard.tsx`

Mudanca na linha `if (isError) return null;` para renderizar um card com:
- Icone de alerta
- Mensagem: "Nao foi possivel carregar as sugestoes"
- Botao "Tentar novamente" que chama `refresh()`

Codigo aproximado do estado de erro:

```tsx
if (isError) {
  return (
    <Card className="border-destructive/20">
      <CardContent className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          <p className="text-sm">Nao foi possivel carregar sugestoes</p>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Tentar novamente
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Impacto**: Apenas visual. Nenhuma mudanca de logica de negocio ou backend.
