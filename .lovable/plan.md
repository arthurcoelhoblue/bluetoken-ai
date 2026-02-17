

# Alterar Senha na Pagina "Meu Perfil"

## Objetivo

Adicionar uma secao "Alterar Senha" na pagina `/me` (Meu Perfil), permitindo que o usuario logado troque a propria senha diretamente, sem precisar sair do sistema.

Tambem corrigir o fluxo de "Esqueci minha senha" que atualmente redireciona para `/auth` em vez de uma pagina dedicada de reset.

---

## Mudancas

### 1. Secao "Alterar Senha" na pagina Me (`src/pages/Me.tsx`)

Adicionar um novo Card abaixo dos cards existentes com:
- Campo "Nova Senha" (minimo 8 caracteres)
- Campo "Confirmar Nova Senha"
- Botao "Alterar Senha"
- Validacao: senhas devem coincidir e ter no minimo 8 caracteres
- Ao salvar, chama `supabase.auth.updateUser({ password: novaSenha })`
- Exibe toast de sucesso ou erro
- Limpa os campos apos salvar com sucesso

### 2. Pagina `/reset-password` (`src/pages/ResetPassword.tsx`)

Criar pagina dedicada para o fluxo de recuperacao de senha por email:
- Detecta o token de recovery na URL (hash)
- Exibe formulario para definir nova senha
- Chama `supabase.auth.updateUser({ password })` para salvar
- Redireciona para `/auth` apos sucesso

### 3. Corrigir redirect do `resetPassword` (`src/contexts/AuthContext.tsx`)

Alterar o `redirectTo` de `/auth` para `/reset-password` para que o link do email de recuperacao leve a pagina correta.

### 4. Registrar rota (`src/App.tsx` ou arquivo de rotas)

Adicionar a rota publica `/reset-password` apontando para o novo componente `ResetPassword`.

---

## Detalhes tecnicos

- A troca de senha do usuario logado usa `supabase.auth.updateUser({ password })` -- nao precisa da senha antiga
- A pagina `/reset-password` precisa ser publica (fora do guard de autenticacao), pois o usuario ainda nao esta logado quando clica no link do email
- O schema de validacao sera inline no componente (dois campos + confirmacao), sem necessidade de criar schema separado
- Icone `Lock` do lucide-react para o card de senha

