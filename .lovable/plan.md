

# Simplificar a criação de Deal

## Jornada atual (mapeamento)

Hoje o vendedor precisa passar por **6 campos obrigatórios/semi-obrigatórios** num único modal:

1. Título (obrigatório)
2. Contato (buscar ou criar — se criar, abre um segundo modal com 3 campos)
3. Valor
4. Temperatura
5. Vendedor Responsável (obrigatório)
6. Stage Inicial

**Pior caso (contato novo):** são **2 modais aninhados** e ~9 campos no total. Mesmo com contato existente, são 6 campos + busca. O vendedor precisa navegar até Pipeline antes de tudo isso.

## Proposta de melhorias

### 1. Reduzir campos visíveis — modo "criação rápida"

O modal abre com apenas **2 campos visíveis**:
- **Contato** (busca + botão criar rápido — mantém como está)
- **Título** (pré-preenchido com nome do contato selecionado)

Os demais campos (Valor, Temperatura, Stage, Vendedor) ficam recolhidos num accordion "Mais opções", com defaults inteligentes já aplicados:
- **Vendedor**: auto-preenchido com o usuário logado
- **Stage**: primeiro stage ativo (já funciona assim)
- **Temperatura**: FRIO (já funciona assim)
- **Valor**: 0 (já funciona assim)

O vendedor cria o deal em **2 cliques + digitação do contato**.

### 2. Auto-preencher título com nome do contato

Quando o vendedor seleciona um contato, o campo Título é preenchido automaticamente com o nome do contato (se estiver vazio). Elimina digitação manual na maioria dos casos.

### 3. Botão flutuante de "Novo Deal" acessível de qualquer tela

Adicionar um FAB (Floating Action Button) ou item no menu de ações rápidas que abre o CreateDealDialog de qualquer página — sem precisar navegar até Pipeline primeiro. O botão pede ao vendedor para selecionar o pipeline antes de abrir o formulário (um select simples inline).

### 4. Tornar "Vendedor Responsável" não obrigatório no schema

Mudar o schema Zod para aceitar string vazia/undefined no `owner_id`, usando o `user.id` como fallback no submit. Isso remove a validação que bloqueia o vendedor mesmo quando ele é o responsável (caso comum).

## Resumo das alterações

| Arquivo | Mudança |
|:--|:--|
| `src/schemas/deals.ts` | `owner_id` passa a ser opcional |
| `src/components/pipeline/CreateDealDialog.tsx` | Reorganizar em modo rápido com accordion "Mais opções"; auto-fill título ao selecionar contato |
| `src/components/layout/AppLayout.tsx` | Adicionar FAB/botão global "Novo Deal" |
| Novo: `src/components/pipeline/GlobalCreateDealDialog.tsx` | Wrapper que inclui seletor de pipeline antes do formulário |

O resultado: criar um deal passa de **6+ campos e 2 modais** para **1-2 campos e 1 clique**.

