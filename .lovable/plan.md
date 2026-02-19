
# Criar o Time de Customer Success — Grupo "CS" com Pendências Dedicadas

## Entendimento do que foi pedido

O usuário quer criar um grupo funcional de **Sucesso do Cliente (CS)**, espelhando a lógica que já existe para o grupo de vendedores (`is_vendedor`). Membros desse grupo:

1. Terão acesso garantido a todas as telas de CS
2. Verão, nas **Pendências**, apenas as tarefas relevantes para CS (ex: nomear ofertas da Tokeniza)
3. Serão identificáveis como CSMs (responsáveis por clientes) no `cs_customers.csm_id`

## Como o sistema atual funciona

O sistema já tem dois mecanismos paralelos:

- **`is_vendedor`** (flag na tabela `profiles`): identifica quem aparece em rankings, metas e filtros de "Dono" no Kanban
- **`access_profiles`** (perfis de tela): controla quais telas cada usuário vê via `user_access_assignments`

A abordagem correta é a mesma: adicionar uma flag **`is_csm`** na tabela `profiles` para identificar membros do time de CS, junto com um novo **perfil de acesso "Sucesso do Cliente"** no sistema de permissões — sem depender de papéis hardcoded.

## O que será feito

### 1. Migração de banco: coluna `is_csm` em `profiles`

```sql
ALTER TABLE public.profiles ADD COLUMN is_csm BOOLEAN NOT NULL DEFAULT FALSE;
```

Essa flag identifica membros do time de CS, assim como `is_vendedor` identifica vendedores. É simples, segura e segue o padrão já estabelecido no sistema.

### 2. Criar perfil de acesso "Sucesso do Cliente" no banco

Inserir um novo perfil de sistema (`is_system = true`) em `access_profiles` com permissões focadas em CS:

- `cs_dashboard`: view + edit
- `cs_clientes`: view + edit
- `cs_pesquisas`: view + edit
- `cs_incidencias`: view + edit
- `cs_playbooks`: view + edit
- `cs_ofertas_admin`: view + edit
- `pendencias_gestor`: view + edit
- `dashboard`: view (Meu Dia)
- `contatos`: view

Isso permite que o admin atribua o perfil "Sucesso do Cliente" a qualquer usuário pela tela de Controle de Acesso já existente.

### 3. Adicionar `cs_ofertas_admin` ao screenRegistry

A tela `/cs/admin/ofertas` já existe mas não está no `SCREEN_REGISTRY`. Precisa ser registrada para aparecer no sistema de permissões.

### 4. Toggle `is_csm` na tela de Controle de Acesso

Adicionar uma coluna **"CS"** na tabela de usuários em `UserAccessList.tsx`, com um `Switch` igual ao de "Vendedor" — permitindo ao admin marcar/desmarcar membros do time de CS.

### 5. Hook `useIsCsm` no AuthContext / hook dedicado

Criar `useIsCsm()` que lê `profile.is_csm` para que componentes possam verificar se o usuário é membro do time de CS.

### 6. Pendências separadas por perfil

Atualmente a página de Pendências (`/pendencias`) mostra tudo para o admin e para quem tem `pendencias_gestor`. O comportamento será refinado:

- **Admins e gestores**: veem tudo (comportamento atual, sem alteração)
- **Membros do CS (`is_csm = true`)**: veem **apenas** a seção "Ofertas Tokeniza sem nome", que é a pendência de CS por excelência

Para implementar isso, a rota `/pendencias` continuará acessível para todos com `pendencias_gestor`, mas o conteúdo será filtrado:

```text
Se is_csm e não ADMIN:
  → mostra apenas seção "Ofertas Tokeniza sem nome"
  
Se ADMIN ou gestor (não CS puro):
  → mostra tudo (comportamento atual)
```

Isso resolve o pedido central: a colaboradora de CS abre Pendências e vê diretamente o trabalho de nomear as ofertas — sem ver as divergências de perda de deals, FAQs, ou deals sem dono, que são tarefas do gestor comercial.

## Arquivos alterados

### Banco de dados (migração SQL)
- `ALTER TABLE profiles ADD COLUMN is_csm boolean DEFAULT false`
- `INSERT INTO access_profiles` com o perfil "Sucesso do Cliente" com permissões CS

### Código frontend
- **`src/config/screenRegistry.ts`**: adicionar `cs_ofertas_admin`
- **`src/components/settings/UserAccessList.tsx`**: coluna "CS" com Switch para `is_csm`
- **`src/hooks/useAccessControl.ts`**: incluir `is_csm` no fetch de `useUsersWithProfiles`
- **`src/types/accessControl.ts`**: adicionar `is_csm` ao tipo `UserWithAccess`
- **`src/pages/admin/PendenciasPerda.tsx`**: filtrar seções exibidas baseado em `is_csm` do usuário logado
- **`src/contexts/AuthContext.tsx`**: expor `profile.is_csm` (já disponível via `profile.*`, sem mudança necessária pois o profile é carregado completo)

## Fluxo de configuração pelo admin

```text
1. Admin abre Controle de Acesso (/admin/access-control)
2. Encontra a colaboradora de CS na lista
3. Liga o toggle "CS" na coluna nova → is_csm = true
4. Atribui o perfil "Sucesso do Cliente" → acesso às telas de CS garantido
5. A colaboradora faz login e vê no menu: CS Dashboard, Clientes CS, etc.
6. Nas Pendências, ela vê apenas "Ofertas Tokeniza sem nome"
   → entra no card de cada oferta, digita o nome, clica Aplicar
   → todos os clientes daquela oferta ficam corrigidos de uma vez
```

## Resultado

```text
Antes:
- Pendências mostravam tudo para qualquer um com acesso à tela
- Sem distinção entre pendências comerciais e pendências de CS
- Sem forma de marcar quem é do time de CS

Depois:
- CSMs (is_csm = true) veem apenas pendências de CS nas Pendências
- Gestores/Admins continuam vendo tudo
- Admin pode marcar/desmarcar CSMs na tela de Controle de Acesso
- Perfil "Sucesso do Cliente" disponível para atribuição no sistema de permissões
- cs_csm_id em cs_customers continua sendo a referência de responsável pelo cliente
```
