

# Reorganizar filtros do Pipeline em duas linhas centralizadas

## Alteração em `src/components/pipeline/PipelineFilters.tsx`

**Linha 1**: Pipeline selector (esquerda) + botão "Novo Deal" (direita) — mantém como está, mas com items centralizados verticalmente.

**Linha 2**: Todos os filtros (Temperatura, Vendedor, Tags, Atendimento IA) centralizados horizontalmente usando `justify-center`, com espaçamento uniforme e tamanhos consistentes.

```
┌──────────────────────────────────────────────────────┐
│  [Pipeline ▾]                           [+ Novo Deal]│
│                                                      │
│    [Temperatura ▾] [Vendedor ▾] [Tags ▾] [🤖 IA]    │
└──────────────────────────────────────────────────────┘
```

### Mudanças específicas:
1. **Linha 2 (linha 73)**: Trocar `flex items-center gap-2 flex-wrap` por `flex items-center justify-center gap-3 flex-wrap` para centralizar os filtros
2. **Uniformizar alturas**: Todos os selects e o botão IA com `h-9` consistente em vez de `h-8`
3. **Adicionar borda/fundo sutil**: Envolver tudo em um container com `bg-muted/30 rounded-lg p-3` para dar destaque visual ao bloco de filtros

