

# Trocar logo da Amélia em todo o sistema

## O que será feito

Substituir o ícone/logo atual (ícone Bot do Lucide e imagens antigas) pela nova logo do cérebro em 3 locais:

### 1. Copiar asset para o projeto
- Copiar `user-uploads://Logo_Amélia_sem_fundo.png` para `public/images/brand/amelia-logo.png` (substituindo a antiga)

### 2. Sidebar (`src/components/layout/AppSidebar.tsx`, linhas 200-203)
- Substituir o `<Bot>` icon dentro do quadrado gradiente por uma `<img>` com a nova logo

### 3. Página de Auth (`src/pages/Auth.tsx`, linhas 88-96)
- Substituir o `<Bot>` icon no header por `<img>` com a nova logo

### 4. Landing Page (`src/pages/LandingPage.tsx`, linhas 15-17)
- Atualizar `LOGO_SRC` e `ICON_SRC` para apontar para a nova imagem (o `LOGO_SRC` já será substituído pelo copy)

## Escopo
- 3 arquivos editados + 1 asset substituído
- Sem mudança de comportamento

