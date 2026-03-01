

# Diagnóstico: Contatos CS aparecendo apenas ~900

## O que está acontecendo

Os dados **estão todos no banco** -- o sync do Tokeniza Gov está funcionando:

| Dado | Quantidade |
|------|-----------|
| Contatos TOKENIZA (total) | 4.481 |
| cs_customers ativos (com investimento) | 981 |
| cs_customers inativos (cadastrados sem investimento) | 3.504 |
| Contratos (posições de investimento) | 7.843 |
| Clientes com contratos | 966 |

O motivo de você ver apenas ~900 é que a **tela de Clientes CS** (`CSClientesPage`) inicia com o filtro `is_active: true` por padrão. Os 3.504 cadastrados sem investimento foram importados como `is_active: false` e ficam escondidos.

## Proposta

### 1. Mudar o filtro padrão da tela CS Clientes

Remover o filtro `is_active: true` como padrão, ou trocar por um seletor visível com 3 opções: "Todos", "Ativos", "Inativos" -- para que o usuário escolha o que quer ver.

### 2. Melhorar a visualização de status

Adicionar badges visuais claros de "Investidor Ativo" vs "Cadastrado" na listagem, para diferenciar rapidamente sem depender de filtro oculto.

### 3. Atualizar contadores do Dashboard CS

Os cards de métricas no Dashboard CS também filtram por `is_active: true`. Ajustar para mostrar:
- Total de clientes na base (todos)
- Investidores ativos
- Cadastrados sem investimento

Assim fica claro que a base tem os ~4.500 registros e não apenas ~900.

## Detalhes técnicos

- **Arquivo**: `src/pages/cs/CSClientesPage.tsx` linha 33 -- mudar `{ is_active: true }` para `{}` e adicionar toggle de filtro no UI
- **Arquivo**: `src/pages/cs/CSDashboardPage.tsx` linhas 24-25 -- ajustar métricas para incluir totais
- O hook `useCSCustomers` já suporta o filtro is_active como opcional, não precisa de mudança

