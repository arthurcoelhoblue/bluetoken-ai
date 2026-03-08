

# Upgrade Visual da Landing Page — Nível Apple

## Análise da Apple MacBook Pro Page

Técnicas identificadas que serão aplicadas na Amélia:

1. **Scroll-driven text scaling** — título hero que reduz de tamanho conforme scroll
2. **Sticky pinned sections** — seção fica fixa enquanto conteúdo revela progressivamente
3. **Parallax layers** — elementos de fundo se movem em velocidades diferentes
4. **Horizontal scroll** — cards deslizam horizontalmente com scroll vertical
5. **Text opacity/blur transitions** — texto desfocado que ganha nitidez ao entrar na viewport
6. **Number counter animation** — métricas contam de 0 ao valor final
7. **Cinematic dark aesthetic** — full-bleed dark com gradientes sutis

## Alterações em `src/pages/LandingPage.tsx`

### 1. Hook `useScrollProgress`
Custom hook que retorna um valor 0→1 baseado na posição de scroll de um elemento (usando `IntersectionObserver` + scroll listener). Base para todos os efeitos.

### 2. Hero — Scroll-driven scaling
- Título começa grande (`scale(1)`) e reduz para `scale(0.85)` + `opacity: 0` conforme scroll
- Logo faz parallax (sobe mais rápido que o scroll)
- Background gradient muda sutilmente com scroll

### 3. Brain Section — Sticky pinned reveal
- Container tem `height: 300vh` (scroll space)
- Conteúdo interno fica `position: sticky; top: 0`
- Os 4 passos aparecem um a um conforme scroll progress (0-25%, 25-50%, 50-75%, 75-100%)
- Cada passo faz fade+slide ao entrar e sai ao próximo

### 4. Features — Horizontal scroll
- Scroll vertical converte em horizontal para os 9 cards de features
- Container sticky com `translateX` baseado em scroll progress

### 5. Metrics — Counter animation
- Números contam de 0 ao valor final quando entram na viewport
- Usa `requestAnimationFrame` para smoothness

### 6. Parallax backgrounds
- Formas geométricas sutis (círculos, gradientes) com `translateY` proporcional ao scroll
- Aplicado nas seções Personas, Platform e Proof

### 7. Text blur reveal
- Subtítulos das seções começam com `filter: blur(4px)` e `opacity: 0.3`
- Transição para nítido conforme scroll progress

### 8. Smooth scroll global
- `html { scroll-behavior: smooth }` já existe, adicionar `scroll-snap` opcional nas seções principais

## Escopo
- **1 arquivo**: `src/pages/LandingPage.tsx` (rewrite significativo das seções)
- **1 arquivo**: `src/index.css` (adicionar utility classes para scroll effects)
- **Sem dependências novas** — tudo com IntersectionObserver + scroll events + CSS transforms
- **Sem mudança de conteúdo** — mesmo texto, mesmas seções, visual premium

