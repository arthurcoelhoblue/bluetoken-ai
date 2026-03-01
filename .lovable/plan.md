

## Análise: Uso dos Livros pela Amélia

### A Amélia ESTÁ usando os livros nas respostas ao lead

O `response-generator.ts` (linha 438-457) faz uma busca RAG com `source_type_filter: 'behavioral'` antes de gerar cada resposta. Os 933 chunks da Tokeniza (SPIN Selling, Armas da Persuasão, Previsivelmente Irracional) são injetados no prompt como "METODOLOGIA DE VENDAS".

Evidência nas respostas recentes do Arthur:
- **Técnica de reframing** (Cialdini): "a viagem você consome agora, o investimento trabalha enquanto você vive" — contraste de frames
- **Perguntas de implicação** (SPIN): "O que está te travando mais — é incerteza sobre a Tokeniza em si, ou sobre qual oferta faz sentido pro seu momento?" — pergunta diagnóstica que aprofunda a dor
- **Ancoragem social** (Cialdini): "mais de 7 mil investidores e R$ 30M captados" — prova social

A Amélia aplica as técnicas **sem citar os livros**, como configurado.

---

### O Copilot NÃO usa os livros — e esse é o gap

O `copilot-chat` não tem nenhuma referência a `behavioral` ou `knowledge-search`. Ele usa apenas dados do CRM (deals, pipeline, métricas). O vendedor recebe análise de dados mas **zero coaching tático** baseado nas metodologias.

---

## Plano: Injetar Coaching Comportamental no Copilot

### Mudança única: `copilot-chat/index.ts`

Na função que monta o contexto antes de chamar a IA, adicionar uma busca RAG behavioral baseada na mensagem do vendedor:

1. **Buscar chunks comportamentais** via `knowledge-search` com `source_type_filter: 'behavioral'` usando a pergunta do vendedor como query
2. **Injetar no prompt do Copilot** uma seção `## COACHING TÁTICO` com os trechos relevantes
3. **Atualizar o system prompt** para instruir a Amélia a dar dicas práticas de abordagem, timing, técnicas de ligação e negociação baseadas nos livros — sem citar nomes de livros, mas aplicando os princípios

Exemplo de output esperado:
> "O Arthur está em paralisia decisória. Técnica recomendada: **Reframe de Custo de Oportunidade** — mostre que NÃO investir também é uma decisão com consequências. Pergunte: 'Arthur, se daqui 6 meses essa oferta tiver encerrado e rendido 18% pra quem entrou, como você vai se sentir sabendo que optou só pela viagem?'"

| Arquivo | Mudança |
|---|---|
| `supabase/functions/copilot-chat/index.ts` | Adicionar fetch RAG behavioral + seção coaching no prompt |

