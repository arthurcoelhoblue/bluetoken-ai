

# Landing Page da Amélia CRM

## O que será feito

Criar a landing page completa da Amélia CRM como uma rota pública (`/home`) e ajustar o roteamento para que seja a home do site.

## Alterações

### 1. Copiar assets de marca para `public/images/brand/`
- `amelia-icon-64.png`
- `amelia-icon-192.png`
- `amelia-logo.png`

### 2. Criar `src/pages/LandingPage.tsx`
Usar o componente fornecido (903 linhas) com todas as seções:
- Navbar com scroll effect e menu mobile
- Hero com logo animado e CTAs
- Personas (Diretor Comercial, Head de Vendas, CEO)
- Brain Section (4 passos da IA)
- Platform comparison (6 ferramentas vs Amélia)
- Chat simulation interativo
- Features grid (9 funcionalidades)
- Comparison table (Amélia vs Pipedrive vs HubSpot vs Salesforce)
- Proof section (programa piloto)
- Pricing (R$180/usuário)
- Demo form com glassmorphism
- Footer completo

### 3. Atualizar `src/App.tsx`
- Lazy import do `LandingPage`
- Adicionar rota pública `/home` apontando para `LandingPage`
- O botão "Agendar Demo" do navbar e o botão "Entrar" no navbar devem linkar para `/auth`

### 4. Ajuste no componente
- O botão "Entrar" no navbar deve usar `react-router-dom` Link para `/auth` em vez de anchor link
- O form de demo pode ser estático por enquanto (sem backend), ou podemos integrar com a lp-lead-ingest edge function futuramente

## Roteamento
- `/home` — Landing page pública (sem autenticação)
- `/` — Comportamento atual mantido (redireciona para `/meu-dia` ou `/auth`)
- `/auth` — Login/Signup

