

# Controle de Acesso Profissional + Sidebar Colapsavel

## Resumo

Implementar um sistema de **Perfis de Acesso customizaveis** onde o gestor (ADMIN) cria perfis (ex: "Closer Senior", "Marketing Pleno") e configura permissoes **tela a tela** com dois niveis: **Visualizar** e **Editar**. Cada usuario recebe um perfil + empresa. Tambem implementar sidebar com grupos colapsaveis.

---

## Parte 1: Banco de Dados (2 novas tabelas)

### Tabela `access_profiles`

Armazena os perfis de acesso customizaveis criados pelo gestor.

| Coluna | Tipo | Default | Descricao |
|--------|------|---------|-----------|
| id | uuid | gen_random_uuid() | PK |
| nome | text | - | NOT NULL. Ex: "Closer Senior", "Marketing Pleno" |
| descricao | text | null | Descricao opcional |
| permissions | jsonb | '{}' | Mapa de permissoes por tela (ver detalhes abaixo) |
| is_system | boolean | false | true = perfil do sistema (nao pode ser excluido) |
| created_at | timestamptz | now() | - |
| updated_at | timestamptz | now() | - |
| created_by | uuid | null | FK -> profiles(id) |

**Formato do campo `permissions` (JSONB):**

```json
{
  "dashboard": { "view": true, "edit": false },
  "pipeline": { "view": true, "edit": true },
  "contatos": { "view": true, "edit": false },
  "conversas": { "view": true, "edit": true },
  "metas": { "view": false, "edit": false },
  "renovacao": { "view": false, "edit": false },
  "cockpit": { "view": true, "edit": false },
  "amelia": { "view": false, "edit": false },
  "cadencias": { "view": true, "edit": false },
  "leads_cadencia": { "view": true, "edit": false },
  "proximas_acoes": { "view": true, "edit": true },
  "templates": { "view": false, "edit": false },
  "knowledge_base": { "view": false, "edit": false },
  "integracoes": { "view": false, "edit": false },
  "benchmark_ia": { "view": false, "edit": false },
  "monitor_sgt": { "view": false, "edit": false },
  "leads_quentes": { "view": true, "edit": false },
  "configuracoes": { "view": false, "edit": false }
}
```

### Tabela `user_access_assignments`

Vincula um usuario a um perfil de acesso e a uma empresa.

| Coluna | Tipo | Default | Descricao |
|--------|------|---------|-----------|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | - | NOT NULL, FK -> profiles(id), UNIQUE |
| access_profile_id | uuid | - | NOT NULL, FK -> access_profiles(id) |
| empresa | empresa_tipo | null | Empresa que o usuario atua (BLUE, TOKENIZA, ou null = todas) |
| assigned_by | uuid | null | FK -> profiles(id) |
| created_at | timestamptz | now() | - |
| updated_at | timestamptz | now() | - |

### RLS

Ambas as tabelas:
- SELECT: usuarios autenticados podem ler (necessario para o sistema verificar permissoes)
- INSERT/UPDATE/DELETE: apenas ADMIN

### Seed: Perfis do sistema

Inserir perfis iniciais (is_system = true) que espelham os roles atuais:

| Perfil | Permissoes |
|--------|------------|
| Administrador | Tudo view + edit |
| Closer | dashboard, pipeline, contatos, conversas, cockpit, leads_cadencia, proximas_acoes, leads_quentes (view+edit) |
| Marketing | dashboard, pipeline, contatos, cadencias, leads_cadencia, templates (view+edit) |
| Auditor | Tudo em view, nada em edit |
| Somente Leitura | Apenas dashboard view |

### Compatibilidade com sistema atual

O sistema atual de roles (`user_roles`) continua funcionando normalmente. O novo sistema de `access_profiles` funciona **em paralelo**:
- Se o usuario tem um `user_access_assignment`, usa as permissoes do perfil customizado
- Se nao tem, faz fallback para o sistema de roles antigo (`ROLE_PERMISSIONS`)
- ADMIN sempre tem acesso total (hardcoded, nao depende de perfil)

Isso garante **zero quebra** -- todos os usuarios atuais continuam com suas permissoes ate que o gestor migre para perfis customizados.

---

## Parte 2: Frontend -- Controle de Acesso

### Registro de telas do sistema

Criar um arquivo `src/config/screenRegistry.ts` com a lista de todas as telas do sistema e seus metadados:

```text
SCREEN_REGISTRY = [
  { key: "dashboard", label: "Meu Dia", group: "Principal", icon: CalendarCheck },
  { key: "pipeline", label: "Pipeline", group: "Principal", icon: Columns3 },
  { key: "contatos", label: "Contatos", group: "Principal", icon: ContactRound },
  { key: "conversas", label: "Conversas", group: "Principal", icon: MessagesSquare },
  { key: "metas", label: "Metas & Comissoes", group: "Comercial", icon: Target },
  { key: "renovacao", label: "Renovacao", group: "Comercial", icon: RefreshCcw },
  { key: "cockpit", label: "Cockpit", group: "Comercial", icon: Gauge },
  { key: "amelia", label: "Amelia IA", group: "Automacao", icon: Bot },
  { key: "cadencias", label: "Cadencias", group: "Automacao", icon: Zap },
  { key: "leads_cadencia", label: "Leads em Cadencia", group: "Automacao", icon: Play },
  { key: "proximas_acoes", label: "Prox. Acoes", group: "Automacao", icon: Clock },
  { key: "templates", label: "Templates", group: "Automacao", icon: FileText },
  { key: "knowledge_base", label: "Knowledge Base", group: "Configuracao", icon: BookOpen },
  { key: "integracoes", label: "Integracoes", group: "Configuracao", icon: Plug },
  { key: "benchmark_ia", label: "Benchmark IA", group: "Configuracao", icon: FlaskConical },
  { key: "monitor_sgt", label: "Monitor SGT", group: "Configuracao", icon: Activity },
  { key: "leads_quentes", label: "Leads Quentes", group: "Configuracao", icon: Flame },
  { key: "configuracoes", label: "Configuracoes", group: "Configuracao", icon: Settings },
]
```

### Hook: `src/hooks/useAccessControl.ts`

- `useAccessProfiles()` -- lista todos os perfis
- `useCreateProfile()` -- cria novo perfil
- `useUpdateProfile()` -- atualiza perfil (nome, descricao, permissions)
- `useDeleteProfile()` -- deleta perfil (apenas se nao e `is_system`)
- `useUserAssignments()` -- lista usuarios com seus perfis atribuidos
- `useAssignProfile()` -- atribui perfil + empresa a um usuario
- `useUsersWithProfiles()` -- busca todos os profiles com seus access_assignments

### Hook: `src/hooks/useScreenPermissions.ts`

- `useCanView(screenKey)` -- retorna boolean se usuario pode ver a tela
- `useCanEdit(screenKey)` -- retorna boolean se usuario pode editar na tela
- Logica: busca `user_access_assignments` do usuario logado, le `permissions` do perfil, retorna resultado
- Fallback: se nao tem assignment, usa `ROLE_PERMISSIONS` do role antigo

### Componentes

| Componente | Descricao |
|-----------|-----------|
| `src/components/settings/AccessControlTab.tsx` | Aba principal com duas sub-secoes: Perfis e Usuarios |
| `src/components/settings/AccessProfileList.tsx` | Lista de perfis existentes com acoes (editar, duplicar, excluir) |
| `src/components/settings/AccessProfileEditor.tsx` | Dialog/Sheet para criar/editar perfil. Mostra todas as telas do sistema agrupadas com checkboxes "Visualizar" e "Editar" |
| `src/components/settings/UserAccessList.tsx` | Tabela de usuarios com coluna de perfil atribuido + empresa |
| `src/components/settings/AssignProfileDialog.tsx` | Dialog para atribuir perfil + empresa a um usuario |

### UI do Editor de Perfil (AccessProfileEditor)

O gestor ve uma tabela com todas as telas do sistema:

```text
+----------------------------------------------------------+
| Criar Perfil de Acesso                                   |
+----------------------------------------------------------+
| Nome: [________________]                                 |
| Descricao: [________________]                            |
+----------------------------------------------------------+
| TELA                    | VISUALIZAR | EDITAR             |
+----------------------------------------------------------+
| PRINCIPAL                                                |
|   Meu Dia               |    [x]     |   [x]             |
|   Pipeline               |    [x]     |   [x]             |
|   Contatos               |    [x]     |   [ ]             |
|   Conversas              |    [x]     |   [x]             |
+----------------------------------------------------------+
| COMERCIAL                                                |
|   Metas & Comissoes      |    [ ]     |   [ ]             |
|   Renovacao              |    [ ]     |   [ ]             |
|   Cockpit                |    [x]     |   [ ]             |
+----------------------------------------------------------+
| AUTOMACAO                                                |
|   Amelia IA              |    [ ]     |   [ ]             |
|   Cadencias              |    [x]     |   [ ]             |
|   ...                                                    |
+----------------------------------------------------------+
| CONFIGURACAO                                             |
|   Knowledge Base         |    [ ]     |   [ ]             |
|   ...                                                    |
+----------------------------------------------------------+
|                     [Cancelar]  [Salvar]                  |
+----------------------------------------------------------+
```

Regras da UI:
- Marcar "Editar" marca automaticamente "Visualizar" (nao pode editar sem ver)
- Desmarcar "Visualizar" desmarca automaticamente "Editar"
- Botoes "Marcar Todos" e "Desmarcar Todos" por grupo
- Perfis `is_system` nao podem ser excluidos (botao desabilitado)

### Alteracao em `Settings.tsx`

Adicionar quinta aba "Acesso" com icone `Shield`:

```text
Canais | IA | Amelia | Webhooks | Acesso
```

### Integracao com Sidebar (AppSidebar)

Atualizar `hasAccess()` para consultar o novo sistema de permissoes:
- Se usuario tem `user_access_assignment`, usa `permissions[screenKey].view`
- Se nao tem, faz fallback para o sistema de roles antigo
- ADMIN sempre tem acesso total

### Integracao com AuthContext

Adicionar ao AuthContext:
- `screenPermissions: Record<string, { view: boolean, edit: boolean }>` -- mapa de permissoes do usuario logado
- `canView(screenKey): boolean`
- `canEdit(screenKey): boolean`
- Carregado no `fetchProfile()` junto com roles

---

## Parte 3: Sidebar Colapsavel

### Comportamento

- Cada grupo (Principal, Comercial, Automacao, Configuracao) tem header clicavel
- Clicar abre/fecha os submenus com animacao
- Grupo com rota ativa abre automaticamente
- Multiplos grupos podem estar abertos
- Sidebar em modo icon (collapsed) nao mostra grupos, apenas icones

### Implementacao

- Usar `Collapsible` do Radix (ja instalado)
- Cada `SidebarGroup` envolvido por `Collapsible`
- `SidebarGroupLabel` vira `CollapsibleTrigger` com chevron rotativo
- `SidebarGroupContent` dentro de `CollapsibleContent`
- `defaultOpen` = `group.items.some(item => isActive(item.url))`

---

## Sequencia de implementacao

| # | Arquivo | Acao |
|---|---------|------|
| 1 | Migration SQL | Criar tabelas `access_profiles` e `user_access_assignments` com RLS + seed |
| 2 | `src/config/screenRegistry.ts` | Criar -- registro de todas as telas do sistema |
| 3 | `src/types/accessControl.ts` | Criar -- tipos TypeScript para perfis e assignments |
| 4 | `src/hooks/useAccessControl.ts` | Criar -- CRUD de perfis e assignments |
| 5 | `src/hooks/useScreenPermissions.ts` | Criar -- hook para verificar permissoes por tela |
| 6 | `src/contexts/AuthContext.tsx` | Atualizar -- adicionar canView/canEdit e carregar permissions |
| 7 | `src/components/settings/AccessProfileEditor.tsx` | Criar -- editor visual de perfil com checkboxes |
| 8 | `src/components/settings/AccessProfileList.tsx` | Criar -- lista de perfis |
| 9 | `src/components/settings/UserAccessList.tsx` | Criar -- tabela de usuarios com perfis |
| 10 | `src/components/settings/AssignProfileDialog.tsx` | Criar -- dialog para atribuir perfil |
| 11 | `src/components/settings/AccessControlTab.tsx` | Criar -- aba principal que orquestra tudo |
| 12 | `src/pages/admin/Settings.tsx` | Atualizar -- adicionar aba "Acesso" |
| 13 | `src/components/layout/AppSidebar.tsx` | Atualizar -- grupos colapsaveis + usar novo sistema de permissoes |

## Impacto

- Sistema atual de roles continua funcionando (fallback)
- Nenhum usuario perde acesso ate que o gestor atribua perfis customizados
- Zero alteracao em edge functions ou tabelas existentes
- Novas tabelas nao afetam nenhuma funcionalidade existente

