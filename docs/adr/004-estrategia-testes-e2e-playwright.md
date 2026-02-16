# ADR 004: Estratégia de Testes E2E com Playwright

**Status**: Aceito
**Data**: 2026-02-16

## Contexto

O projeto possuía uma suíte de 314 testes unitários e de integração, mas carecia de testes End-to-End (E2E). Isso significava que:

- **Não havia garantia** de que os fluxos críticos do usuário (login, criação de deal, etc.) funcionavam de ponta a ponta em um ambiente real.
- **Regressões visuais e de fluxo** poderiam passar despercebidas.
- **A confiança no deploy** era baseada em testes manuais, que são lentos, caros e propensos a erro.

## Decisão

Adotar o **Playwright** para testes E2E, com a seguinte estratégia:

1.  **Execução via GitHub Actions**: Os testes rodam no CI/CD, não no ambiente de build do Lovable, contornando as limitações de infraestrutura.
2.  **Autenticação via Injeção de Token**: Para evitar a complexidade e instabilidade do fluxo de login do Google OAuth, os testes injetam um token de sessão válido do Supabase diretamente no `localStorage`.
3.  **Page Object Model (POM)**: A estrutura de testes utiliza o padrão POM para organizar o código, com classes de página (`*.page.ts`) que encapsulam a lógica de interação com cada tela.
4.  **Cobertura de Testes Priorizada**:
    -   **Smoke Tests**: Verificação rápida de que todas as páginas principais carregam sem erros.
    -   **Fluxos Críticos**: Testes detalhados para Autenticação/RBAC, Pipeline, Contatos e Cadências.

## Consequências

### Positivas
- **Confiança no Deploy**: Agora é possível validar automaticamente que os fluxos mais importantes não quebraram antes de cada deploy.
- **Detecção de Regressões**: Qualquer mudança que quebre um fluxo crítico será detectada pelo CI.
- **Documentação Viva**: Os testes E2E servem como uma documentação executável de como o sistema deve se comportar.

### Negativas
- **Manutenção dos Testes**: Testes E2E são mais frágeis que testes unitários e exigem manutenção contínua.
- **Dependência de Infraestrutura Externa**: Requer a configuração de secrets (`E2E_USER_ACCESS_TOKEN`, etc.) no GitHub Actions.

## Alternativas Consideradas

- **Cypress**: Outra excelente ferramenta de testes E2E. Rejeitado porque o Playwright possui melhor suporte a múltiplos navegadores e uma arquitetura mais moderna.
- **Testes Manuais**: Rejeitado por não ser escalável nem confiável.
