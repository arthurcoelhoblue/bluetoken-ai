

# Adicionar Campo de Ramal (Extensao) no Cadastro do Usuario

## Objetivo

Permitir que o administrador configure o numero do ramal (extension) de cada usuario diretamente no formulario de criacao e na tela de edicao do usuario, em vez de obrigar a ir ate a pagina `/admin/zadarma`.

---

## Mudancas

### 1. Schema do formulario (`src/schemas/users.ts`)

Adicionar campo opcional `ramal` ao schema `createUserSchema`:

```text
ramal: z.string().optional().or(z.literal(''))
```

### 2. CreateUserDialog (`src/components/settings/CreateUserDialog.tsx`)

- Adicionar campo "Ramal" (input de texto) ao formulario, logo apos o campo "Vendedor"
- No `handleSubmit`, apos criar o usuario com sucesso, se `data.ramal` estiver preenchido, inserir na tabela `zadarma_extensions` com o `user_id` retornado e a empresa selecionada

### 3. UserAccessList (`src/components/settings/UserAccessList.tsx`)

- Adicionar coluna "Ramal" na tabela de usuarios
- Buscar o ramal de cada usuario via query na `zadarma_extensions` (ou enriquecer a query existente com um join)
- Permitir edicao inline (campo de texto editavel direto na celula, com salvamento ao perder o foco ou pressionar Enter)

### 4. AssignProfileDialog (`src/components/settings/AssignProfileDialog.tsx`)

- Adicionar campo "Ramal" no dialog de atribuicao de perfil, permitindo editar o ramal junto com perfil e empresas

### 5. Edge function `admin-create-user`

- Receber campo opcional `ramal` no body
- Se preenchido, inserir registro na `zadarma_extensions` apos criar o usuario

---

## Detalhes tecnicos

- O ramal e salvo na tabela `zadarma_extensions` que ja existe, usando os campos `extension_number`, `user_id` e `empresa`
- Um usuario pode ter ramais diferentes por empresa, entao o campo aparecera associado a empresa selecionada
- A query de usuarios em `useAccessControl.ts` sera enriquecida para trazer tambem o ramal (left join com `zadarma_extensions`)
- O campo e opcional -- nem todo usuario precisa de ramal
