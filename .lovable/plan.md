

# Reorganizar itens do Sidebar

Mover dois itens de menu entre grupos no `AppSidebar.tsx` e no `screenRegistry.ts`:

| Item | Grupo Atual | Novo Grupo |
|---|---|---|
| Leads Quentes | Configuracao | Comercial |
| Monitor SGT | Configuracao | Automacao |

## Detalhes Tecnicos

### Arquivo 1: `src/components/layout/AppSidebar.tsx`

- Remover `{ title: 'Leads Quentes', ... }` do grupo "Configuracao"
- Adicionar ao final do grupo "Comercial"
- Remover `{ title: 'Monitor SGT', ... }` do grupo "Configuracao"
- Adicionar ao final do grupo "Automacao"

### Arquivo 2: `src/config/screenRegistry.ts`

- Alterar o `group` de `leads_quentes` de `'Configuracao'` para `'Comercial'`
- Alterar o `group` de `monitor_sgt` de `'Configuracao'` para `'Automacao'`

Nenhuma alteracao de banco de dados ou logica -- apenas reposicionamento visual no menu.

