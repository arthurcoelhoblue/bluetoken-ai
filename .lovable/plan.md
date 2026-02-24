

## Botao "Ver Deals" condicional na tela de Lead

### O que muda

Na tela de detalhe do lead (`LeadDetail.tsx`), ao lado do botao "Criar Deal", adicionar um botao **"Ver Deals"** que so aparece quando existem deals vinculados ao contato CRM do lead.

### Como funciona

1. **Consulta de deals existentes**: Junto com a busca do `crmContactId`, tambem buscar deals na tabela `deals` onde `contact_id = crmContactId`. Armazenar a lista de deals encontrados em estado local.

2. **Botao condicional**: Se houver deals vinculados, exibir um botao "Ver Deals (N)" que abre um pequeno dialog/popover listando os deals com link para o pipeline.

3. **Navegacao**: Cada deal na lista leva o usuario para a pagina do pipeline (`/deals?pipeline=X&deal=Y`) ou abre o `DealDetailSheet` diretamente.

### Detalhes tecnicos

**Arquivo: `src/pages/LeadDetail.tsx`**

- Adicionar estado `linkedDeals` (array de deals basicos: id, titulo, valor, status, stage nome)
- No `useEffect` que ja busca `crmContactId`, encadear uma segunda query:
  ```
  supabase.from('deals')
    .select('id, titulo, valor, status, pipeline_id, pipeline_stages:stage_id(nome, cor)')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(10)
  ```
- Novo botao com icone `Briefcase` (lucide) ao lado de "Criar Deal":
  - Texto: "Ver Deals (N)" onde N e a quantidade
  - Ao clicar, abre um `Popover` ou `Dialog` simples com a lista
  - Cada item mostra titulo, valor formatado, badge do stage e um link para navegar

**Novo componente: `src/components/leads/LinkedDealsPopover.tsx`**

Componente leve que recebe a lista de deals e renderiza:
- Lista com titulo, valor, badge de stage (com cor)
- Botao "Abrir" em cada deal que navega para `/deals` com o pipeline correto
- Se nao houver deals, o componente nao renderiza nada (o botao tambem fica oculto)

### Resultado esperado

- Lead SEM deals: aparece apenas "Criar Deal" (comportamento atual)
- Lead COM deals: aparece "Ver Deals (2)" ao lado, com popover listando os deals vinculados

