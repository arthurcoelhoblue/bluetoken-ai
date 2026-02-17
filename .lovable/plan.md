

# Mover Controle de Acesso para o Menu Principal

Tirar a aba "Acesso" de dentro da pagina Configuracoes e transformar em um item proprio no menu lateral, dentro do grupo "Configuracao".

---

## Mudancas

### 1. Sidebar (`src/components/layout/AppSidebar.tsx`)

Adicionar novo item no grupo "Configuracao":

```text
{ title: 'Controle de Acesso', url: '/admin/access-control', icon: Shield, screenKey: 'controle_acesso' }
```

### 2. Nova Pagina (`src/pages/admin/AccessControl.tsx`)

Criar pagina dedicada que renderiza o componente `AccessControlTab` dentro do `AppLayout`, com titulo e descricao proprios.

### 3. Rota (`src/App.tsx`)

Adicionar rota `/admin/access-control` apontando para a nova pagina.

### 4. TopBar (`src/components/layout/TopBar.tsx`)

Adicionar entrada no `ROUTE_TITLES`:
```text
'/admin/access-control': 'Controle de Acesso'
```

### 5. Settings (`src/pages/admin/Settings.tsx`)

Remover a aba "Acesso" (tab trigger + tab content) e o import do `AccessControlTab`. O grid passa de 6 para 5 colunas.

### 6. Screen Registry (`src/config/screenRegistry.ts`)

Registrar a nova tela `controle_acesso` com URL `/admin/access-control` para que o sistema de permissoes funcione corretamente.

