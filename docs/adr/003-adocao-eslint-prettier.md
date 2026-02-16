# ADR 003: Adoção de ESLint e Prettier para Qualidade de Código

**Status**: Aceito
**Data**: 2026-02-16

## Contexto

O projeto não possuía ferramentas de linting e formatação de código automatizadas. Isso levava a:

- **Inconsistência de Estilo**: Cada desenvolvedor formatava o código de uma maneira diferente.
- **Regressões de Qualidade**: Era fácil introduzir código com `console.log`, `any`, ou outros padrões indesejados sem que ninguém percebesse.
- **Revisões de PR Manuais e Tediosas**: Muito tempo era gasto em revisões de PR apontando problemas de estilo e qualidade que poderiam ser automatizados.

## Decisão

1.  **Adotar ESLint**: Para análise estática de código e aplicação de regras de qualidade.
    -   Configurado com `typescript-eslint`, `eslint-plugin-react-hooks`, e `eslint-plugin-react-refresh`.
    -   Regras chave ativadas: `no-console` (warn), `@typescript-eslint/no-explicit-any` (warn), `consistent-type-imports` (warn).

2.  **Adotar Prettier**: Para formatação de código automática e consistente.
    -   Configurado com um arquivo `.prettierrc` com as regras padrão do projeto.
    -   Integrado com o ESLint para evitar conflitos.

## Consequências

### Positivas
- **Consistência de Código**: Todo o código agora segue o mesmo padrão de estilo e formatação.
- **Prevenção de Erros**: O ESLint agora avisa sobre potenciais problemas durante o desenvolvimento.
- **Revisões de PR Mais Rápidas**: A equipe pode focar na lógica de negócio em vez de estilo de código.

### Negativas
- **Configuração Inicial**: Exigiu tempo para configurar e resolver os erros e warnings iniciais.
- **Curva de Aprendizagem Mínima**: A equipe precisa se acostumar a rodar o linter e o formatador.

## Alternativas Consideradas

- **Apenas ESLint**: Rejeitado porque o ESLint não é tão bom em formatação quanto o Prettier.
- **Apenas Prettier**: Rejeitado porque o Prettier não faz análise de qualidade de código.
