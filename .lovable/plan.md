

# Limpeza: Remover Produto "Plataforma Tokeniza" (Duplicação)

## Diagnóstico

O produto **"Plataforma Tokeniza"** (`c17429c2`) tem **7 seções** que são praticamente cópias do que já existe no produto principal **"Investimentos Tokenizados - Base de Conhecimento"** (`fce3e087`):

| Seção Plataforma Tokeniza | Duplica no Produto Principal |
|---|---|
| GERAL: "O que é a Tokeniza?" | Já coberto pela descricao_curta + "Como Funciona" |
| GERAL: "Visão Geral da Tokeniza" | Mesmos dados (7 mil investidores, R$30M, 1.5%) |
| PITCH: "Pitch Comercial" | Mesmas informações do pitch existente |
| PITCH: "Pitch Rápido de Vendas" | Mesmas informações do pitch existente |
| RISCOS: "Riscos e Mitigações" | Versão mais fraca do "Quais são os riscos?" existente |
| ESTRUTURA_JURIDICA: "Estrutura Jurídica" | Duplicado |
| ESTRUTURA_JURIDICA: "Estrutura Jurídica e Regulação" | Duplicado (menciona código CVM 000070-1) |

**Único dado potencialmente único**: o código CVM `000070-1` na seção "Estrutura Jurídica e Regulação".

## Plano

### Passo 1 — Preservar dado único
Verificar se o código CVM `000070-1` já consta em alguma seção do produto principal. Se não, adicionar ao conteúdo da seção de riscos ou estrutura jurídica existente (se houver) ou ao pitch.

Como o produto principal não tem seção ESTRUTURA_JURIDICA, criar uma seção enxuta com apenas o essencial jurídico, consolidando as duas seções duplicadas em uma só.

### Passo 2 — Deletar as 7 seções do "Plataforma Tokeniza"
Remover todas as `knowledge_sections` com `product_knowledge_id = 'c17429c2-6e21-4111-bfab-2c45f9a61197'`.

### Passo 3 — Deletar o produto "Plataforma Tokeniza"
Remover o registro de `product_knowledge` com `id = 'c17429c2-6e21-4111-bfab-2c45f9a61197'`.

### Passo 4 — Re-indexar RAG
Chamar o endpoint `knowledge-embed` com `{ "action": "reindex", "empresa": "TOKENIZA" }` para limpar embeddings órfãos e atualizar o índice.

## Resultado
- De 3 produtos TOKENIZA ativos, ficam apenas **2**: "Investimentos Tokenizados" (principal) e "Tokeniza Portugal" (oferta real)
- Zero duplicação
- Amélia recebe contexto mais limpo e preciso nas buscas

