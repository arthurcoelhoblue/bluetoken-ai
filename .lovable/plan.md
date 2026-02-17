

# Inativar Usuario pelo EditUserDialog

## Objetivo

Adicionar um switch "Ativo" no dialog de edicao de usuario, permitindo que o administrador desative ou reative um usuario. O sistema ja bloqueia usuarios inativos no `ProtectedRoute` -- basta conectar o campo `is_active` ao formulario de edicao.

## Mudancas

### 1. Schema (`src/schemas/users.ts`)

Adicionar campo `isActive` (boolean, default `true`) ao `editUserSchema`.

### 2. EditUserDialog (`src/components/settings/EditUserDialog.tsx`)

- Receber nova prop `currentIsActive` (boolean)
- Adicionar switch "Ativo / Inativo" ao formulario, com descricao "Usuarios inativos nao conseguem acessar o sistema"
- Incluir `is_active` no update do `profiles`

### 3. UserAccessList (`src/components/settings/UserAccessList.tsx`)

- Passar `currentIsActive` (campo `is_active` do usuario) ao `EditUserDialog`

## Detalhes tecnicos

- A coluna `is_active` ja existe na tabela `profiles` (boolean, default true)
- O `ProtectedRoute` ja verifica `profile.is_active` e exibe tela de "Acesso Desativado" quando false
- Nenhuma alteracao de banco de dados e necessaria
- Nenhuma alteracao no `ProtectedRoute` e necessaria
