
# Integrar Mapeamento de Ofertas Tokeniza na Tela de Pendências

## Contexto

Existem **55 ofertas distintas** sem nome na base, totalizando **614 contratos** de **78 clientes** e **R$ 1.044.814** em volume. A tela de mapeamento já foi criada em `/cs/admin/ofertas`, mas ela está isolada no menu Admin, exigindo que a colaboradora saiba onde encontrá-la.

A ideia é incluir essas 55 ofertas diretamente na tela de **Pendências do Gestor** (`/pendencias`), seguindo o mesmo padrão visual dos cards de "Deals sem Vendedor" e "Divergências de Perda" que já existem — com um card por oferta, campo de input para o nome e botão "Aplicar".

## Como funciona a lógica atual de Pendências

`PendenciasPerda.tsx` já agrega múltiplas fontes de pendências:
- `useLossPendencies()` → divergências de perda
- `useFaqPendencies()` → FAQs aguardando aprovação
- `useOrphanDeals()` → deals sem vendedor

Cada fonte retorna uma lista; a página soma os totais e exibe seções separadas. O badge no menu (`WorkbenchPage`) mostra o total consolidado de pendências.

## O que será feito

### 1. Adicionar seção "Ofertas Tokeniza sem nome" em `PendenciasPerda.tsx`

Importar `useCSOfertasSemNome` e `useUpdateOfertaNome` (hooks já existem) e adicionar:
- Uma nova seção no final da lista de pendências, com header e ícone de `Tag`
- Um card por oferta com: ID truncado, período, qtd de clientes, volume total, input para nome, botão "Aplicar"
- Ao aplicar: `UPDATE` em massa + card desaparece da lista (revalidação automática via `invalidateQueries`)
- Badge de total de pendências inclui as ofertas sem nome no contador

### 2. Atualizar o contador de pendências no Workbench

`WorkbenchPage.tsx` usa `useLossPendencyCount()` para exibir o badge. Será necessário atualizar essa contagem para incluir as ofertas sem nome (ou criar um hook de contagem consolidada).

### 3. Arquivos alterados

**`src/pages/admin/PendenciasPerda.tsx`**:
- Importar `useCSOfertasSemNome`, `useUpdateOfertaNome` e ícones necessários (`Tag`, `Input`)
- Adicionar componente `OfertaSemNomeCard` seguindo o padrão dos outros cards
- Incluir no cálculo `totalPendencies`
- Renderizar nova seção "Ofertas Tokeniza sem nome (55)" no corpo da página

**`src/pages/WorkbenchPage.tsx`** (opcional, se quisermos o contador atualizado):
- Incluir contagem de ofertas sem nome no badge de pendências

### Resultado visual na página de Pendências

```text
┌─────────────────────────────────────────────────────┐
│ ⚠ Pendências do Gestor                              │
├─────────────────────────────────────────────────────┤
│ 👤 Deals sem Vendedor (N)                           │
│   [cards existentes...]                             │
├─────────────────────────────────────────────────────┤
│ ❓ FAQs pendentes (N)                               │
│   [cards existentes...]                             │
├─────────────────────────────────────────────────────┤
│ 🏷 Ofertas Tokeniza sem nome (55)                   │
│  ┌──────────────────────────────────────────────┐   │
│  │ ID: aca33ec2…  Mar/24 – Abr/24              │   │
│  │ 42 clientes · R$ 108.206                    │   │
│  │ [__________________________] [Aplicar]      │   │
│  └──────────────────────────────────────────────┘   │
│  [... outros 54 cards ...]                          │
└─────────────────────────────────────────────────────┘
```

### Fluxo para a colaboradora

1. Acessa `/pendencias` normalmente
2. Rola até a seção "Ofertas Tokeniza sem nome"
3. Vê o ID truncado + período + impacto (clientes e volume)
4. Digita o nome correto (ex: "Renda Fixa Tokeniza Mar/24") e clica "Aplicar"
5. O card some imediatamente; todos os 42 investidores daquela oferta ficam corrigidos na base
6. Repete para as demais ofertas — em média ~10 minutos para resolver as 55

A tela de `/cs/admin/ofertas` pode ser mantida como alternativa avançada (com tabela densa para processar tudo de uma vez), mas o fluxo principal passará pelas Pendências.
