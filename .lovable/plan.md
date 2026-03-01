

# Migrar Categorias Tokeniza de Produtos para Base de Conhecimento

## Situação Atual

Existem 5 produtos-categoria na tabela `product_knowledge` que não são ofertas reais:

| Produto | ID | Seções |
|---------|-----|--------|
| Token Agro | AGRO | 0 |
| Token Atleta | ATLETA | 0 |
| Tokeniza Agro | TOKENIZA_AGRO | 0 |
| Tokeniza Atleta | TOKENIZA_ATLETA | 0 |
| Tokeniza Imóvel | TOKENIZA_IMOVEL | 0 |

Nenhum deles tem seções de conhecimento — são apenas cadastros com `descricao_curta`. Há duplicação (Token Agro / Tokeniza Agro, Token Atleta / Tokeniza Atleta).

Já existem 2 produtos legítimos que devem permanecer:
- **Investimentos Tokenizados - Base de Conhecimento** (com 10+ seções de FAQ, objeções, pitch, riscos)
- **Clubfix** (oferta real com seções de riscos e informações)

## Plano

### Passo 1 — Criar seção "Categorias de Ofertas" no produto principal

Adicionar uma nova `knowledge_section` do tipo `GERAL` no produto "Investimentos Tokenizados - Base de Conhecimento" (`fce3e087-0c80-4d45-8946-524827710aa8`) com título **"Categorias de Ofertas da Tokeniza"** contendo:

```
A Tokeniza trabalha com diferentes categorias de ofertas de investimento. 
Isso NÃO significa que existem ofertas abertas em todas as categorias neste momento.

As categorias possíveis são:

**Tokeniza Imóvel**: Frações de imóveis residenciais, comerciais e de aluguel por temporada.
**Tokeniza Agro**: Operações do agronegócio — fazendas, plantações, safras garantidas.
**Tokeniza Atleta**: Tokens vinculados à carreira de atletas profissionais.

IMPORTANTE: Para saber quais ofertas estão DISPONÍVEIS neste momento, 
consulte apenas as ofertas ativas na plataforma (plataforma.tokeniza.com.br).
Não afirme que existem ofertas abertas em uma categoria sem verificar.
```

### Passo 2 — Desativar/remover os 5 produtos-categoria

Deletar os 5 registros de `product_knowledge` que representam categorias (não têm seções, não perdem dados):
- `5afdb60e` (Token Agro)
- `cf315d30` (Token Atleta)
- `825943b2` (Tokeniza Agro)
- `ff1e979b` (Tokeniza Atleta)
- `c3dafd55` (Tokeniza Imóvel)

### Passo 3 — Re-embeddar a nova seção

Após inserir a seção, chamar o endpoint de re-indexação RAG para que o novo conteúdo fique disponível para busca semântica.

## Resultado

- Amélia saberá que essas categorias **existem** como possibilidades
- Amélia **não afirmará** que há ofertas abertas nessas categorias
- A base de conhecimento fica mais limpa e precisa

