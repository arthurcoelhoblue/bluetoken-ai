
# Sazonalidade nas Metas + Configuracao de Motivos de Perda

## 1. Sazonalidade como Default nas Metas

### Situacao Atual
- A tabela `metas_vendedor` armazena `meta_valor` e `meta_deals` por vendedor/mes/ano
- O gestor edita meta individualmente, mes a mes, para cada vendedor
- Nao existe conceito de meta anual nem distribuicao automatica

### O que vamos fazer
Adicionar um modo de "Meta Anual" na pagina de Metas. O gestor informa o valor anual e o sistema distribui automaticamente usando indices de sazonalidade que vem pre-preenchidos com os dados reais do relatorio SGT:

```text
Indices Default (do relatorio):
Jan: 0.63  |  Fev: 0.75  |  Mar: 1.22  |  Abr: 0.73
Mai: 2.28  |  Jun: 0.73  |  Jul: 0.84  |  Ago: 0.96
Set: 0.32  |  Out: 1.21  |  Nov: 1.07  |  Dez: 2.47
```

O gestor pode ajustar qualquer indice antes de aplicar. Ao confirmar, o sistema gera os 12 registros em `metas_vendedor` com os valores proporcionais.

### Implementacao

**Nova tabela**: `sazonalidade_indices`
- empresa (text), mes (int 1-12), indice (numeric), updated_at, updated_by
- Unique: (empresa, mes)
- Seed com os indices default do relatorio
- RLS: ADMIN pode CRUD, demais podem ler

**Hook**: `useSazonalidade()` em `src/hooks/useMetas.ts`
- Query para ler indices por empresa
- Mutation para atualizar indices

**Dialog**: `src/components/metas/MetaAnualDialog.tsx`
- Select de vendedor (ou "Todos")
- Input de meta anual (valor e deals)
- Grid 12 meses mostrando indices (editaveis) e valores calculados
- Preview: `meta_mes = (meta_anual * indice) / soma_indices`
- Botao "Aplicar" que faz upsert nos 12 meses

**Pagina `MetasPage.tsx`**:
- Adicionar botao "Definir Meta Anual" ao lado do seletor de mes (visivel so para ADMIN)
- Ao clicar, abre o MetaAnualDialog

### Configuracao dos Indices

Adicionar uma tab "Comercial" nas Configuracoes (`Settings.tsx`) onde o admin pode ajustar os indices de sazonalidade e os motivos de perda.

---

## 2. Configuracao de Motivos de Perda

### Situacao Atual
- A tabela `deal_loss_categories` ja existe com 7 categorias: Preco, Concorrencia, Timing, Sem Necessidade, Sem Resposta, Produto Inadequado, Outro
- Tem colunas: id, codigo, label, descricao, posicao
- Usada em `DealCard.tsx`, `DealDetailSheet.tsx` e `PendenciasPerda.tsx`
- **Nao existe UI para gerenciar essas categorias**

### O que vamos fazer
Criar um CRUD de motivos de perda na nova tab "Comercial" das Configuracoes.

**Componente**: `src/components/settings/LossCategoriesConfig.tsx`
- Lista draggable (reordenavel) com as categorias existentes
- Cada item mostra: codigo, label, descricao, botao editar/excluir
- Botao "Adicionar Categoria"
- Dialog de edicao: label, codigo (auto-gerado do label em UPPER_SNAKE), descricao
- Protecao: `PRODUTO_INADEQUADO` nao pode ser removido (usado na logica de bypass de tempo minimo)

**Hook**: `useLossCategoriesAdmin()` em `src/hooks/useDeals.ts`
- `useCreateLossCategory()` - INSERT
- `useUpdateLossCategory()` - UPDATE
- `useDeleteLossCategory()` - DELETE
- `useReorderLossCategories()` - UPDATE posicao em batch

---

## 3. Nova Tab "Comercial" nas Configuracoes

**Arquivo**: `src/pages/admin/Settings.tsx`
- Adicionar tab "Comercial" com icone `BarChart3`
- Grid cols-6 no TabsList

**Componente**: `src/components/settings/ComercialTab.tsx`
- Secao 1: **Indices de Sazonalidade** - grid 4x3 com os 12 meses, input numerico para cada indice, botao salvar
- Secao 2: **Motivos de Perda** - componente LossCategoriesConfig

---

## Detalhes Tecnicos

### Migracao SQL
1. Criar tabela `sazonalidade_indices` com seed dos valores default
2. RLS: leitura para autenticados, escrita para ADMIN

### Calculo de distribuicao
```text
Para meta anual de R$ 120.000 com os indices default:
soma_indices = 0.63+0.75+1.22+0.73+2.28+0.73+0.84+0.96+0.32+1.21+1.07+2.47 = 13.21
meta_jan = 120000 * (0.63/13.21) = R$ 5.723
meta_mai = 120000 * (2.28/13.21) = R$ 20.711
meta_dez = 120000 * (2.47/13.21) = R$ 22.437
```

### Arquivos

| Arquivo | Acao |
|---------|------|
| `src/pages/admin/Settings.tsx` | Adicionar tab "Comercial" |
| `src/components/settings/ComercialTab.tsx` | Novo - secoes sazonalidade + motivos |
| `src/components/settings/LossCategoriesConfig.tsx` | Novo - CRUD de categorias de perda |
| `src/components/metas/MetaAnualDialog.tsx` | Novo - dialog de distribuicao anual |
| `src/pages/MetasPage.tsx` | Adicionar botao "Meta Anual" |
| `src/hooks/useMetas.ts` | Adicionar `useSazonalidade` + `useUpsertMetasBatch` |
| `src/hooks/useDeals.ts` | Adicionar mutations CRUD para loss categories |
| Migracao SQL | Tabela `sazonalidade_indices` + seed + RLS |
