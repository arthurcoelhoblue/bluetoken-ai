

# Cadastro de Usuarios + Perfil Super Admin

## Resumo

Duas mudancas:

1. **Perfil "Super Admin"** -- novo perfil de sistema, nao editavel, nao removivel, com 100% de acesso. Atribuido automaticamente a Arthur Coelho e Filipe Chagas.
2. **Botao "Novo Usuario"** na aba de Acesso para que o gestor cadastre novos usuarios diretamente pelo painel (sem precisar que a pessoa se cadastre pela tela de login).

---

## Parte 1: Perfil Super Admin

### Migration SQL

- Inserir novo perfil `Super Admin` na tabela `access_profiles` com `is_system = true` e todas as permissoes `view: true, edit: true`
- Criar `user_access_assignments` para os dois usuarios:
  - Arthur Coelho (`3eb15a6a-9856-4e21-a856-b87eeff933b1`) -> Super Admin, empresa = null (todas)
  - Filipe Chagas (`e93b132b-e104-4c37-ae73-2501cf4cc19e`) -> Super Admin, empresa = null (todas)

### Diferenca entre "Administrador" e "Super Admin"

| Aspecto | Administrador | Super Admin |
|---------|--------------|-------------|
| Editavel | Sim (permissoes podem ser alteradas) | Nao (completamente bloqueado) |
| Pode ser excluido | Nao (is_system) | Nao (is_system) |
| Pode ser atribuido a outros | Sim | Nao (restrito no frontend) |
| Permissoes | Tudo | Tudo + protegido contra alteracao |

### Mudanca no frontend

- No `AccessProfileEditor`, perfis com nome "Super Admin" nao podem ter permissoes alteradas (ja coberto pelo `is_system`)
- No `AccessProfileList`, o Super Admin aparece com badge especial "Super Admin" em vez de "Sistema"
- No `AssignProfileDialog`, o perfil Super Admin nao aparece na lista de perfis disponiveis para atribuicao (apenas ADMINs hardcoded podem ter)

---

## Parte 2: Cadastro de Novos Usuarios

### Abordagem

Criar uma edge function `admin-create-user` que usa o Supabase Admin API (service role) para:
1. Criar o usuario no auth (`admin.createUser`)
2. O trigger `handle_new_user` ja existente cria o profile automaticamente
3. Opcionalmente ja atribuir um perfil de acesso e empresa

A edge function e necessaria porque a criacao de usuarios pelo admin requer o service role key (nao pode ser feita do client).

### Edge Function: `supabase/functions/admin-create-user/index.ts`

- Recebe: `{ email, nome, password, access_profile_id?, empresa? }`
- Valida que o caller e ADMIN (verifica JWT + role)
- Cria usuario via `supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nome } })`
- Se `access_profile_id` foi informado, insere em `user_access_assignments`
- Retorna o usuario criado

### Componente: `src/components/settings/CreateUserDialog.tsx`

Dialog com formulario:

| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| Nome | text | Sim |
| Email | email | Sim |
| Senha temporaria | password | Sim |
| Perfil de acesso | select (lista de perfis) | Nao |
| Empresa | select (BLUE / TOKENIZA / Todas) | Nao |

Botao "Criar Usuario" chama a edge function.

### Mudanca em `UserAccessList.tsx`

Adicionar botao "Novo Usuario" no header da secao, ao lado do titulo, abrindo o `CreateUserDialog`.

---

## Sequencia de implementacao

| # | Acao |
|---|------|
| 1 | Migration SQL: inserir perfil Super Admin + assignments para Arthur e Chagas |
| 2 | Criar edge function `admin-create-user` |
| 3 | Criar `CreateUserDialog.tsx` |
| 4 | Atualizar `UserAccessList.tsx` com botao "Novo Usuario" |
| 5 | Atualizar `AccessProfileList.tsx` para badge especial Super Admin |
| 6 | Atualizar `AssignProfileDialog.tsx` para esconder Super Admin da lista |

## Impacto

- Zero alteracao em tabelas existentes (apenas INSERT de dados)
- Nova edge function isolada
- Componentes existentes recebem ajustes menores

