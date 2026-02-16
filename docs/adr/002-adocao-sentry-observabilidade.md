# ADR 002: Adoção do Sentry para Error Tracking e Observabilidade

**Status**: Aceito
**Data**: 2026-02-16

## Contexto

O projeto não possuía nenhuma ferramenta de monitoramento de erros em produção. Isso resultava em:

- **Falta de Visibilidade**: Erros aconteciam no ambiente do usuário e a equipe de desenvolvimento não ficava sabendo.
- **Dificuldade de Debug**: Quando um erro era reportado, era difícil reproduzir e entender o contexto (navegador, ações do usuário, etc.).
- **Reatividade**: A equipe só agia após reclamação do cliente.

## Decisão

Adotar o **Sentry** como plataforma de monitoramento de erros e performance. A implementação inclui:

1.  **Error Tracking**: Captura automática de todos os erros não tratados no frontend.
2.  **Session Replay**: Gravação de sessões onde erros ocorrem (com mascaramento de dados sensíveis) para facilitar a reprodução.
3.  **Performance Monitoring (Traces)**: Amostragem de 10% das transações para identificar gargalos de performance.
4.  **Web Vitals**: Coleta de métricas de performance (LCP, CLS, INP) e envio para o banco de dados para análise histórica.

O Sentry foi inicializado no `main.tsx` e integrado com um `ErrorBoundary` global para capturar erros de renderização do React.

## Consequências

### Positivas
- **Proatividade**: A equipe agora é notificada de erros em tempo real.
- **Resolução Rápida de Bugs**: O contexto completo fornecido pelo Sentry (stack trace, breadcrumbs, replay) acelera o debug.
- **Visibilidade sobre a Saúde da Aplicação**: É possível entender o impacto dos erros (quantos usuários afetados, frequência, etc.).

### Negativas
- **Adição de dependências**: `@sentry/react` e `web-vitals` foram adicionados ao projeto.
- **Overhead de performance mínimo**: O Sentry adiciona um pequeno overhead ao bundle e ao runtime, mas é negligenciável.

## Alternativas Consideradas

- **LogRocket**: Similar ao Sentry, mas com foco maior em session replay. Rejeitado por ser mais caro e ter um plano gratuito mais restritivo.
- **Datadog, New Relic**: Plataformas de observabilidade mais completas (e complexas). Rejeitadas por serem overkill para o estágio atual do projeto.
- **Desenvolver solução interna**: Rejeitado por ser inviável e reinventar a roda.
