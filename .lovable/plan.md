

# Reorganizar filtros: Pipeline + Novo Deal + IA centralizados na linha 1

## Layout proposto

```text
┌──────────────────────────────────────────────────────────┐
│     [Pipeline ▾]     [+ Novo Deal]     [🤖 Atend. IA]   │
│                                                          │
│     [Temperatura ▾]   [Vendedor ▾]   [Tags ▾]           │
└──────────────────────────────────────────────────────────┘
```

## Alteração em `src/components/pipeline/PipelineFilters.tsx`

**Linha 1** (centralizada com `justify-center`): Pipeline selector, botão Novo Deal e botão Atendimento IA — os 3 elementos principais de ação.

**Linha 2** (centralizada, permanece como está): Temperatura, Vendedor, Tags — filtros secundários.

### Mudança concreta:
1. Mover o botão "Atendimento IA" (linhas 112-123) da linha 2 para a linha 1
2. Trocar o layout da linha 1 de `flex items-center gap-3` (com `ml-auto`) para `flex items-center justify-center gap-3` — centralizando os 3 elementos
3. Remover o `<div className="ml-auto">` wrapper do botão Novo Deal
4. Linha 2 fica apenas com Temperatura, Vendedor e Tags (sem alteração de posicionamento)

