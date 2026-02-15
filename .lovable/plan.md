
# Filtros Avancados na Tela de Acao em Massa

## Objetivo

Quanto mais nichada a selecao de deals, melhor a personalizacao da Amelia. Hoje so existe busca por texto e pipeline. Vamos adicionar filtros para **todas as colunas relevantes**, permitindo combinacoes como "Deals QUENTES no estagio Proposta do vendedor X com tag Y criados nos ultimos 30 dias".

## Filtros a Adicionar

| Filtro | Tipo | Valores |
|--------|------|---------|
| **Pipeline** | Select | Ja existe |
| **Estagio** | Select (dinamico por pipeline) | Stages do pipeline selecionado |
| **Temperatura** | Select | Frio, Morno, Quente |
| **Vendedor (Owner)** | Select | Lista de owners dos deals |
| **Tags** | Select | Tags unicas extraidas dos deals |
| **Origem** | Select | Valores unicos de `origem` (ex: WhatsApp, Formulario, Manual) |
| **Valor minimo / maximo** | Input numerico | Range de valor do deal |
| **Data de criacao** | Select de periodo | Hoje, 7 dias, 30 dias, 90 dias, Todos |
| **Score probabilidade** | Select de faixa | Alto (>=70), Medio (40-69), Baixo (<40) |

## Design da UI

- Area de filtros expandivel usando `Collapsible` com botao "Mais filtros" / "Menos filtros"
- Primeira linha (sempre visivel): Busca + Pipeline + Temperatura + Estagio
- Segunda linha (collapsible): Vendedor + Tags + Origem + Valor + Periodo + Score
- Badge indicando quantos filtros ativos alem do padrao
- Botao "Limpar filtros" quando houver filtros ativos
- Tabela ganha novas colunas: **Vendedor**, **Origem**, **Tags** para dar visibilidade ao que esta sendo filtrado

## Mudancas na Query de Deals

O hook `useDeals` ja busca deals de UM pipeline. Para a tela de massa, precisamos buscar deals de TODOS os pipelines (ou do selecionado). Vamos:

1. Quando `filterPipeline === "ALL"`, buscar deals de todos os pipelines da empresa ativa
2. Aplicar todos os filtros client-side no `useMemo` (ja que o volume e limitado a deals ABERTOS)

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/AmeliaMassActionPage.tsx` | Adicionar estados dos filtros, UI collapsible, logica de filtragem expandida, novas colunas na tabela, badge de filtros ativos, botao limpar |

## Detalhes Tecnicos

### Estados de filtro adicionados

```typescript
const [filterStage, setFilterStage] = useState('ALL');
const [filterTemperatura, setFilterTemperatura] = useState('ALL');
const [filterOwner, setFilterOwner] = useState('ALL');
const [filterTag, setFilterTag] = useState('ALL');
const [filterOrigem, setFilterOrigem] = useState('ALL');
const [filterValorMin, setFilterValorMin] = useState('');
const [filterValorMax, setFilterValorMax] = useState('');
const [filterPeriodo, setFilterPeriodo] = useState('ALL');
const [filterScore, setFilterScore] = useState('ALL');
const [showMoreFilters, setShowMoreFilters] = useState(false);
```

### Logica de filtragem expandida no useMemo

Cada filtro e aplicado sequencialmente no array de deals. Opcoes dinamicas (stages, owners, tags, origens) sao extraidas dos deals carregados para popular os selects.

### Busca multi-pipeline

Quando `filterPipeline === "ALL"`, buscar deals de todos os pipelines usando multiplas chamadas ao `useDeals` ou uma query customizada direta.

### Contagem de filtros ativos

Um contador mostra quantos filtros estao diferentes do padrao ("ALL"/vazio), exibido como badge no botao "Mais filtros".
