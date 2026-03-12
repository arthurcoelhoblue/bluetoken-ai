

## Plano: Modo TV no Cockpit

Adicionar um botão "Modo TV" no header do Cockpit que alterna para uma visualização fullscreen, fundo escuro, fontes grandes, com auto-refresh e responsivo para telas horizontais e verticais.

### Conteúdo do Modo TV

| Seção | Descrição |
|---|---|
| **KPIs principais** | Vendas do mês (qtd ganhos), Receita total do mês, Pipeline aberto, Win Rate, Ticket Médio |
| **Abas de empresa** | Tabs para filtrar por empresa (BLUE, TOKENIZA, MPUPPE, AXIA, Todas) |
| **Negócios criados por dia** | Gráfico de barras usando `deals.created_at` agrupado por dia (últimos 30 dias) |
| **Ranking vendedores** | Top 5 com barras visuais |
| **Funil resumido** | Barras horizontais proporcionais |
| **Relógio** | Hora em tempo real no canto |

### Responsividade

- **Horizontal (TV/monitor)**: Grid 3 colunas — KPIs no topo, ranking + funil + gráfico abaixo
- **Vertical (celular/tablet)**: Stack vertical, KPIs em 2 colunas, seções empilhadas

### Implementação

**`src/components/cockpit/TVDashboard.tsx`** (novo)
- Componente fullscreen: `fixed inset-0 z-50 bg-gray-950 text-white overflow-auto`
- Botão fechar (ESC e botão X) para voltar ao cockpit normal
- Abas de empresa no topo usando Tabs do shadcn
- Auto-refresh: queries com `refetchInterval: 60_000`
- Relógio com `setInterval` a cada segundo
- Botão fullscreen (API `document.documentElement.requestFullscreen()`)
- Cursor oculto após 3s de inatividade
- Fontes: `text-4xl` para KPIs, `text-xl` para rankings

**`src/hooks/useDealsCreatedPerDay.ts`** (novo)
- Query direta na tabela `deals` com `created_at >= 30 dias atrás`
- Filtra por empresa(s) via join com pipelines
- Agrupa por dia usando JS (`.reduce()` sobre `created_at`)
- Retorna `{ dia: string, count: number }[]`

**`src/pages/CockpitPage.tsx`** (editar)
- Adicionar `const [tvMode, setTvMode] = useState(false)`
- Botão `<Monitor />` "Modo TV" ao lado do Select de pipeline no header
- Renderizar `<TVDashboard onClose={() => setTvMode(false)} />` quando ativo

### Estrutura visual

```text
┌─────────────────────────────────────────────────────────┐
│  📺 PAINEL DE VENDAS    [BLUE|TOKEN|MPUPPE|AXIA|TODAS]  │
│                                          15:42  [⛶] [✕] │
├───────────┬───────────┬───────────┬─────────────────────┤
│ 🏆 12     │ 💰 R$1.2M │ 📊 34.2%  │ 🎟 R$100k           │
│ Vendas    │ Receita   │ Win Rate  │ Ticket Médio        │
├───────────┴───────────┴───────────┴─────────────────────┤
│  RANKING VENDEDORES        │  FUNIL                     │
│  1. João  ████████ R$400k  │  Qualificação ████████ 15  │
│  2. Maria ██████   R$280k  │  Proposta     █████   10   │
│  3. Pedro ████     R$150k  │  Negociação   ███      6   │
├────────────────────────────┴────────────────────────────┤
│  NEGÓCIOS CRIADOS POR DIA (barras - últimos 30 dias)   │
│  ▃▅▇▃▅▆▇▃▅▃▅▇▃▅▆▇▃▅▃▅▇▃▅▆▇▃▅▃▅▇                      │
└─────────────────────────────────────────────────────────┘
```

Nenhuma mudança de banco necessária — usa dados existentes das views analytics + query direta em `deals`.

