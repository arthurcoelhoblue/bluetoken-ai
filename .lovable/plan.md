

# Corrigir Amélia inventando informações de produto

## Diagnóstico

### Problema encontrado
A Amélia respondeu "geralmente entre R$ 5 e R$ 10 mil" — informação inventada. A causa raiz é dupla:

1. **Conflito na base de conhecimento**: As FAQs dizem "a partir de R$ 100" (tokens genéricos), enquanto o PITCH Tokeniza Portugal diz "a partir de R$ 5.000" (SAFE). A IA recebe ambos e interpola um range que não existe.

2. **Prompt insuficiente para forçar citação literal**: Apesar de ter "PROIBIDO INVENTAR", o prompt não instrui a Amélia a citar valores exatamente como estão na base — ela parafraseia e arredonda.

3. **Fallback do `product_knowledge` não tem `preco_texto`**: Para Tokeniza, `preco_texto` é NULL. Então quando o RAG falha ou retorna chunks ambíguos, não há preço canônico.

### Mensagens problemáticas do Arthur Coelho
- "geralmente entre R$ 5 e R$ 10 mil" — valor inventado
- "a partir de R$ 5 mil em ativos reais com rentabilidade acima da renda fixa" — generalizou o mínimo do Portugal para toda a Tokeniza

## Plano de correção

### 1. Reforçar prompt anti-alucinação no response-generator
No `systemPrompt` default (linha 315-339), adicionar regra mais dura:

```
REGRA DE OURO — VALORES E PREÇOS:
- Cite valores EXATAMENTE como aparecem na seção PRODUTOS. Não arredonde, não crie faixas, não interpole.
- Se houver valores diferentes para ofertas diferentes, especifique QUAL oferta tem qual valor.
- Se não encontrar o valor exato para a oferta perguntada, diga: "Vou confirmar o valor exato com a equipe e te retorno."
- NUNCA diga "geralmente", "em média", "entre X e Y" para valores — cite o valor específico da oferta.
```

### 2. Melhorar injeção de contexto RAG com separação por oferta
No `prompt` final (linha 357-378), após a seção PRODUTOS, adicionar instrução:

```
Se os dados de PRODUTOS contêm informações de ofertas diferentes, distinga claramente qual informação pertence a qual oferta. Nunca misture dados de ofertas distintas numa mesma frase.
```

### 3. Corrigir dados conflitantes na base de conhecimento
Os FAQs duplicados sobre "valor mínimo" precisam ser harmonizados:
- FAQ 1: "a partir de R$ 100" — refere-se a tokens de ofertas genéricas
- FAQ 2: "a partir de R$100" — duplicado
- PITCH Portugal: "a partir de R$ 5.000" — específico do SAFE

Recomendação: atualizar os FAQs para especificar que o mínimo varia por oferta e listar os exemplos corretos.

### 4. Preencher `preco_texto` no product_knowledge da Tokeniza
Atualmente é NULL. Preencher com texto canônico tipo "Varia por oferta. Tokens: a partir de R$ 100. SAFE Portugal: a partir de R$ 5.000."

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/sdr-ia-interpret/response-generator.ts` | Reforçar regras de citação literal de valores no systemPrompt e no prompt final |

## Ação manual necessária (base de conhecimento)
- Revisar FAQs duplicados sobre valor mínimo
- Preencher `preco_texto` no `product_knowledge` da Tokeniza
- Considerar adicionar FAQ específico: "Qual o mínimo para Tokeniza Portugal?" com resposta "R$ 5.000 via SAFE tokenizado"

