# ADR 001: Refatoração do Hook Monolítico `useCadences.ts`

**Status**: Aceito
**Data**: 2026-02-16

## Contexto

O hook `useCadences.ts` cresceu para mais de 750 linhas, centralizando toda a lógica de queries, mutations, eventos e runs de cadências. Isso resultou em:

- **Baixa Coesão**: Lógicas distintas (listagem vs. detalhes vs. mutações) misturadas.
- **Alta Complexidade**: Difícil de entender, manter e testar.
- **Acoplamento Elevado**: Qualquer mudança no hook tinha potencial para impactar múltiplas áreas.

## Decisão

Decompor o hook monolítico em 4 módulos menores e mais coesos, seguindo o padrão de responsabilidade única:

1.  `useCadences.ts`: Apenas queries de listagem de cadências.
2.  `useCadenceRuns.ts`: Queries de listagem e detalhes de runs.
3.  `useCadenceEvents.ts`: Queries de eventos e próximas ações.
4.  `useCadenceMutations.ts`: Todas as mutations (update, create, delete).

Um barrel file (`index.ts`) foi criado para re-exportar todos os hooks, garantindo retrocompatibilidade e evitando a necessidade de refatorar todas as chamadas existentes no código.

## Consequências

### Positivas
- **Manutenibilidade Aumentada**: Cada módulo tem um propósito claro e é fácil de entender.
- **Testabilidade Melhorada**: É possível testar cada hook de forma isolada.
- **Redução de Complexidade**: A complexidade ciclomática de cada arquivo foi drasticamente reduzida.

### Negativas
- **Aumento no número de arquivos**: De 1 para 5 arquivos.

## Alternativas Consideradas

- **Manter como está**: Rejeitado por ser insustentável a longo prazo.
- **Refatoração parcial**: Rejeitado por não resolver o problema fundamental de coesão.
