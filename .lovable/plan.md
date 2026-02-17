
# Adicionar Botao de Editar Usuario

## Objetivo

Criar um dialog de edicao de usuario que permita alterar nome, flag vendedor, gestor e ramal de usuarios ja existentes, acessivel por um botao de edicao na tabela de usuarios.

---

## Mudancas

### 1. Novo componente `EditUserDialog` (`src/components/settings/EditUserDialog.tsx`)

Criar um dialog similar ao `CreateUserDialog`, mas para edicao:
- Campos editaveis: Nome, Vendedor (switch), Gestor (select), Ramal
- Email aparece como campo somente leitura (informativo)
- Senha nao aparece (nao faz sentido editar aqui)
- Perfil e Empresa nao aparecem (ja tem dialogs dedicados para isso)
- Ao salvar:
  - Atualiza `profiles` (nome, is_vendedor, gestor_id)
  - Faz upsert/delete no `zadarma_extensions` para o ramal
- Invalida as queries relevantes apos salvar

### 2. Schema de edicao (`src/schemas/users.ts`)

Adicionar um novo schema `editUserSchema` com os campos editaveis:
- `nome` (obrigatorio, min 2 chars)
- `isVendedor` (boolean)
- `gestorId` (string, default 'none')
- `ramal` (string, opcional)

### 3. Botao na tabela (`src/components/settings/UserAccessList.tsx`)

- Adicionar estado `editTarget` para controlar qual usuario esta sendo editado
- Adicionar botao com icone de lapis (`Pencil`) na coluna de acoes, antes dos botoes existentes
- Renderizar o `EditUserDialog` quando `editTarget` estiver preenchido
- Passar os dados atuais do usuario (nome, is_vendedor, ramal) como valores iniciais do formulario

---

## Detalhes tecnicos

- O `EditUserDialog` recebe: `userId`, `currentNome`, `currentEmail`, `currentIsVendedor`, `currentGestorId`, `currentRamal`
- A atualizacao do perfil usa `supabase.from('profiles').update(...)` direto
- O ramal usa a mesma logica de upsert/delete ja existente no `UserAccessList`
- O gestor_id e atualizado na tabela `profiles` (campo `gestor_id`)
