# Consistência entre Stage do Pipeline e Temperatura

## O Problema

As tags no card de conversa vêm de fontes independentes:

- **Stage** ("Atacar agora!", "Contato Iniciado") → vem da tabela `pipeline_stages` via `deals.stage_id`
- **Temperatura** ("Frio", "Morno", "Quente") → vem do campo `deals.temperatura`

Não existe nenhuma regra que sincronize esses dois valores. Um vendedor pode mover um deal para o stage "Atacar agora!" sem que a temperatura mude de "Frio" para "Quente". Da mesma forma, um lead pode ser classificado automaticamente como "Frio" mesmo estando num stage urgente.

## Opções de Correção

Há duas abordagens possíveis:

### Opção A — Atualizar temperatura automaticamente ao mudar de stage

Quando um deal é movido para um stage marcado como prioritário (ex: "Atacar agora!", "Negociação"), a temperatura é automaticamente elevada para QUENTE. Isso garante consistência mas remove controle manual do vendedor sobre a temperatura.

### Opção B — Esconder a tag de temperatura quando o stage já comunica urgência

Se o stage já indica urgência (ex: "Atacar agora!"), não mostrar a badge de temperatura redundante/contraditória. A temperatura continuaria existindo nos dados, mas visualmente seria suprimida quando o stage já carrega essa informação.

## Qual abordagem você prefere?

Preciso saber para implementar a correção correta. Na opção A, a mudança seria no backend (mutation de mover deal). Na opção B, seria apenas no componente `ConversaCard`.

&nbsp;

&nbsp;

Prefiro a opção B

&nbsp;