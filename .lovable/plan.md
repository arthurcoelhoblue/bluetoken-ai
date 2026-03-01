

## Plano: Trocar Sonnet → Haiku 4.5 no refinamento de chunks

### Mudança única

No arquivo `supabase/functions/knowledge-embed/index.ts`, na função `refineChunkWithSonnet` (linha 279):

- Trocar o modelo de `claude-sonnet-4-20250514` para `claude-haiku-4-5-20241022`
- Renomear a função para `refineChunkWithHaiku` (e as referências na linha 319)
- Atualizar logs de `[Sonnet]` para `[Haiku]`

### Impacto

- **Custo por chunk**: ~$0.009 → ~$0.0024 (4x mais barato)
- **Custo por livro (~100 chunks)**: ~$0.90 → ~$0.24
- **Qualidade**: Haiku é perfeitamente capaz para classificação + extração estruturada (a tarefa aqui é decidir se o chunk é relevante e extrair pontos-chave, não gerar texto criativo)
- **Latência**: Haiku é mais rápido que Sonnet, o pipeline inteiro roda mais rápido

Todo o resto do pipeline (pdf-parse mecânico, auto-exclusão do PDF, arquivamento, UI) permanece idêntico.

