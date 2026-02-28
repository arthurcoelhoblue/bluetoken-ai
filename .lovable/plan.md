

# Excluir templates Tokeniza criados antes de 26/03

## Diagnóstico

Encontrei **28 templates de mensagem** da Tokeniza criados antes de 26/03/2026. Eles são referenciados por:
- **13 cadence_steps** (via `template_codigo`)
- **5 cadências** (que contêm os steps)
- **~100 lead_cadence_runs** (execuções dessas cadências)
- **~8.713 lead_cadence_events** (eventos dessas execuções)

Não há foreign keys diretas para `message_templates`, mas as cadências e steps ficarão órfãos se não forem limpos.

## Plano de execução

Uma única migration SQL que deleta na ordem correta de dependências:

1. `lead_cadence_events` → referenciados pelos runs das cadências Tokeniza pré-26/03
2. `lead_cadence_runs` → das cadências Tokeniza pré-26/03
3. `cadence_stage_triggers` → das cadências Tokeniza pré-26/03
4. `cadence_steps` → das cadências Tokeniza pré-26/03
5. `cadences` → Tokeniza pré-26/03 (5 cadências)
6. `message_templates` → Tokeniza pré-26/03 (28 templates)

Os dados de `product_knowledge` e `knowledge_faq` da Tokeniza **não serão afetados** — apenas templates e suas cadências dependentes.

