

# Melhorias: Cadastro de Cliente CS + Filtro e Scrollbar de Notificacoes

## 1. Cadastro de Cliente CS na tela Clientes CS

### O que muda
Adicionar um botao "Novo Cliente" na pagina `/cs/clientes` que abre um dialog para cadastrar um novo registro na tabela `cs_customers`.

### Campos do formulario
- **Contato** (obrigatorio): Select com busca que lista contatos existentes da tabela `contacts`
- **Empresa** (obrigatorio): Pre-preenchido com a empresa ativa (BLUE/TOKENIZA)
- **CSM responsavel** (opcional): Select com usuarios do sistema
- **MRR** (opcional): Campo numerico para valor mensal recorrente
- **Data da proxima renovacao** (opcional): Date picker
- **Tags** (opcional): Campo de texto com tags
- **Notas** (opcional): Textarea

Os campos `health_score`, `health_status`, `risco_churn_pct` usam os defaults do banco (50, ATENCAO, 0).

### Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/cs/CSCustomerCreateDialog.tsx` | **Novo** - Dialog com formulario de cadastro |
| `src/hooks/useCSCustomers.ts` | Adicionar mutation `useCreateCSCustomer` |
| `src/pages/cs/CSClientesPage.tsx` | Adicionar botao "Novo Cliente" no header |

---

## 2. Filtro, Scrollbar e Barra de Rolagem no Sininho de Notificacoes

### Problema atual
O componente `NotificationBell` usa `<ScrollArea className="max-h-80">`, mas o `ScrollArea` do Radix precisa de uma **altura fixa** (nao `max-h`) para que o viewport interno calcule o overflow e exiba a scrollbar corretamente. Com `max-h-80` o conteudo simplesmente cresce sem scrollbar visivel.

### Solucao scrollbar
Trocar `max-h-80` por `h-80` no `ScrollArea`, para que o Radix detecte o overflow e renderize a barra de rolagem estilizada. A altura fixa de `h-80` (320px) e ideal para o popover -- cabe bem na tela e mostra ~5-6 notificacoes antes de precisar rolar.

### Filtros por gravidade
Adicionar uma linha de chips compactos abaixo do header do popover:

```
[Todas] [Alertas] [Insights] [Deals]
```

- **Todas**: Mostra tudo (default)
- **Alertas**: Filtra tipos criticos: `SLA_ESTOURADO`, `AMELIA_ALERTA`, `AMELIA_SEQUENCIA`
- **Insights**: Filtra: `AMELIA_INSIGHT`, `AMELIA_CORRECAO`, `LEAD_QUENTE`
- **Deals**: Filtra: `DEAL_PARADO`, `DEAL_AUTO_CRIADO`

Os chips usam o componente `ToggleGroup` com estilo compacto. O filtro e local (client-side).

### Arquivo

| Arquivo | Acao |
|---------|------|
| `src/components/layout/NotificationBell.tsx` | Corrigir ScrollArea para `h-80`, adicionar filtros por categoria |

---

## Detalhes tecnicos

### CSCustomerCreateDialog
- Usa `useContacts()` para listar contatos no select
- Usa `useCreateCSCustomer()` (novo) para inserir na tabela `cs_customers`
- Campos obrigatorios: `contact_id` e `empresa`
- Apos criar, redireciona para o detalhe do cliente (`/cs/clientes/:id`)

### NotificationBell - scrollbar + filtros
- Trocar `className="max-h-80"` por `className="h-80"` no `<ScrollArea>`
- Adicionar `useState<string>('ALL')` para estado do filtro
- Mapeamento de tipos por categoria em constante `FILTER_GROUPS`
- Chips com `ToggleGroup` tipo `single`, variante `outline`, tamanho compacto
- Filtragem aplicada sobre o array `notifications` antes do render

### Total: 3 arquivos modificados + 1 novo

