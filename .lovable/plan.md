

# Aplicar Manual de Identidade Visual — Amélia CRM

## O que muda

O manual define cores, tipografia e gradientes específicos. O sistema atual usa valores próximos mas não exatos. Abaixo, as correções necessárias.

### Conversão das cores do manual para HSL

| Cor | HEX | HSL |
|-----|-----|-----|
| Deep Teal | #0B4B4B | 180 74% 17% |
| Teal Primary | #379C8B | 170 47% 41% |
| Vivid Mint | #5FC0A5 | 155 42% 56% |
| Light Mint | #BCE9D9 | 153 50% 82% |
| Dark Slate | #2B3946 | 209 24% 22% |

### Diferenças atuais vs. manual

| Variável | Atual | Manual (correto) |
|----------|-------|-----------------|
| `--primary` (light) | `160 41% 65%` (#66CDAA) | `170 47% 41%` (Teal Primary #379C8B) |
| `--primary-glow` | `160 41% 75%` | `155 42% 56%` (Vivid Mint) |
| `--accent` | `160 51% 60%` | `155 42% 56%` (Vivid Mint) |
| `--ring` | `160 51% 60%` | `170 47% 41%` (Teal Primary) |
| `--foreground` (light) | `222 47% 11%` | `209 24% 22%` (Dark Slate) |
| Font | Plus Jakarta Sans | Inter |
| Gradients | genéricos 160° | Deep Teal → Vivid Mint |

### Arquivos a alterar

**1. `src/index.css`** — CSS variables (principal)
- **Fonte**: Trocar import do Google Fonts de `Plus+Jakarta+Sans` para `Inter`
- **Light mode `:root`**:
  - `--primary`: `170 47% 41%` (Teal Primary)
  - `--primary-foreground`: `0 0% 100%` (branco, pois o teal é escuro)
  - `--primary-glow`: `155 42% 56%` (Vivid Mint)
  - `--foreground` e `--card-foreground` e `--popover-foreground`: `209 24% 22%` (Dark Slate)
  - `--accent`: `155 42% 56%` (Vivid Mint)
  - `--accent-foreground`: `0 0% 100%`
  - `--ring`: `170 47% 41%`
  - `--sidebar-primary`: `170 47% 41%`
  - `--sidebar-ring`: `170 47% 41%`
  - Gradients: `Deep Teal hsl(180 74% 17%)` → `Vivid Mint hsl(155 42% 56%)`
  - Glow shadows: atualizar para usar `hsl(170 47% 41%)`
- **Dark mode `.dark`**:
  - `--primary`: `155 42% 56%` (Vivid Mint — mais claro para contraste em fundo escuro)
  - `--primary-foreground`: `0 0% 8%`
  - `--primary-glow`: `153 50% 82%` (Light Mint)
  - `--accent`: `155 42% 56%`
  - `--ring`: `155 42% 56%`
  - `--sidebar-primary`: `155 42% 56%`
  - `--sidebar-ring`: `155 42% 56%`
  - Gradients e glows: mesma adequação

**2. `tailwind.config.ts`**
- Trocar `fontFamily.sans` de `["Plus Jakarta Sans", ...]` para `["Inter", "system-ui", "sans-serif"]`

### O que NÃO muda
- Estrutura de componentes, layouts, modo escuro/claro (mantidos)
- Landing page (`/home`) — já usa as cores do manual diretamente via inline styles
- Lógica de negócio, rotas, autenticação

