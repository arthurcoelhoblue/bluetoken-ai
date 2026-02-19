
# Fundir abas "Investimentos" e "Aportes" para clientes Tokeniza

## O que existe hoje

Para clientes **Tokeniza**, o detalhe do cliente tem 8 abas:

```text
Visão Geral | Investimentos | Pesquisas | Deals | Aportes | Incidências | Health | Notas
```

- **Investimentos** (tab `contratos`): lista os contratos `crowdfunding` com oferta, data, valor e status — mas sem KPIs
- **Aportes** (tab `renovacao`): mostra KPIs (Total Investido, Ticket Médio, Quantidade, Último Aporte) + alerta de inatividade + a mesma lista de contratos embaixo

Para clientes **Blue**, a aba `renovacao` continua sendo "Renovação" (regra de negócio diferente — elegibilidade, vencimento de contrato, etc.) e **não é afetada pela mudança**.

## O que será feito

### 1. Eliminar a aba "Aportes" para Tokeniza

A tab `renovacao` com o label "Aportes" será removida do `TabsList` para clientes Tokeniza. Clientes Blue continuam com "Renovação" normalmente.

### 2. Enriquecer a aba "Investimentos" com os KPIs e alerta

O conteúdo da aba `contratos` (que hoje só mostra a lista) vai incorporar o que estava nos "Aportes":

**Estrutura final da aba "Investimentos" para Tokeniza:**
```text
┌─────────────────────────────────────────────────────┐
│  KPIs: Total Investido | Ticket Médio | Qtd | Último │
├─────────────────────────────────────────────────────┤
│  [Alerta de inatividade se aplicável]               │
├─────────────────────────────────────────────────────┤
│  Lista detalhada de investimentos (timeline)        │
└─────────────────────────────────────────────────────┘
```

### 3. Arquivos alterados

- **`src/pages/cs/CSClienteDetailPage.tsx`**:
  - Remover o `TabsTrigger` e `TabsContent` de `renovacao` para Tokeniza (mas mantê-los para Blue)
  - Para Tokeniza, a aba `contratos` passa a renderizar `<CSAportesTab>` (que já tem KPIs + lista completa)
  - Para Blue, a aba `contratos` continua como está (lista de contratos) e `renovacao` continua sendo `<CSRenovacaoTab>`

- **`src/components/cs/CSAportesTab.tsx`**:
  - O componente já contém KPIs + alerta + lista completa — está pronto para ser a aba unificada
  - Nenhuma mudança de lógica necessária, apenas passará a ocupar o espaço da aba `contratos` para Tokeniza

### Resultado

```text
Antes (Tokeniza):
Visão Geral | Investimentos | Pesquisas | Deals | Aportes | Incidências | Health | Notas
                 ↑ só lista         ↑ KPIs + lista (redundante)

Depois (Tokeniza):
Visão Geral | Investimentos | Pesquisas | Deals | Incidências | Health | Notas
                 ↑ KPIs + alerta + lista completa

Blue: sem alteração
```

O número de abas cai de 8 para 7 para clientes Tokeniza, eliminando a redundância sem perder nenhuma informação.
