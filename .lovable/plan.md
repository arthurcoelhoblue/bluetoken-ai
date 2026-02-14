
# Rebranding: Amelia CRM + Nova Home Interna

## Contexto

Os usuarios sao exclusivamente internos (colaboradores do Grupo Blue). Isso muda a abordagem: a home nao precisa "vender" o produto — deve ser uma tela de boas-vindas elegante com identidade forte da Amelia que transmita profissionalismo e leve ao login rapidamente.

---

## Parte 1: Renomear em todos os pontos

Substituir "Blue CRM" / "SDR IA" / "Tokeniza & Blue Consult" por **Amelia CRM** e **Grupo Blue**.

| Arquivo | Mudanca |
|---------|---------|
| `index.html` | Title, meta tags, OG -> "Amelia CRM - Grupo Blue" |
| `src/pages/Index.tsx` | H1 e textos |
| `src/pages/Auth.tsx` | Header, card title, subtitulo, footer |
| `src/components/layout/AppSidebar.tsx` | Label "Blue CRM" -> "Amelia CRM" |
| `src/components/layout/TopBar.tsx` | Fallback title "Blue CRM" -> "Amelia CRM" |
| `supabase/functions/copilot-chat/index.ts` | System prompt referencia |
| `src/index.css` | Comentario no topo do arquivo |

---

## Parte 2: Nova Home Page (Index.tsx)

Redesign completo para usuarios nao autenticados. Como sao usuarios internos, o foco e:
- **Identidade visual forte** — Amelia como marca central
- **Acesso rapido** — botao de login proeminente
- **Elegancia** — efeitos visuais sutis, sem exagero de marketing

### Layout

```text
+----------------------------------------------------+
|                                                      |
|       [Circulos decorativos blur animados]           |
|                                                      |
|        [Icone Bot grande + glow pulsante]            |
|                                                      |
|              Amelia CRM                              |
|         Sua inteligencia comercial                   |
|                                                      |
|    [3 mini-stats: 24/7 | IA | Automacao]            |
|                                                      |
|          [ Entrar  -> ]                              |
|                                                      |
|   (c) 2025 Grupo Blue. Powered by Amelia IA.        |
+----------------------------------------------------+
```

### Elementos visuais

- **Background**: `bg-gradient-hero` com 3-4 circulos decorativos (`absolute`, `rounded-full`, blur alto, opacidade baixa, cores primary/accent) posicionados aleatoriamente para dar profundidade
- **Icone Amelia**: Bot icon h-24 w-24 dentro de container arredondado com `bg-gradient-primary`, `shadow-glow` e `animate-pulse-glow`
- **Titulo**: "Amelia CRM" com classe `text-gradient` (gradiente azul-teal)
- **Subtitulo**: "Sua inteligencia comercial sempre ativa" — simples e direto
- **Mini stats**: 3 pequenos indicadores em linha (icones com labels) — nao metricas reais, apenas identidade (ex: "IA Conversacional", "Pipeline Inteligente", "Automacao 24/7") com staggered `animate-fade-in` e `animation-delay-*`
- **Botao**: `variant="gradient"` `size="xl"` com texto "Entrar" e seta
- **Footer**: "(c) 2025 Grupo Blue" discreto

### Animacoes (todas ja existem no CSS)

- `animate-slide-up` no bloco principal
- `animate-pulse-glow` no icone
- `animate-fade-in` com delays nos stats
- Circulos de fundo com animacao sutil de flutuacao (novo keyframe `float` simples adicionado ao CSS)

---

## Parte 3: Auth Page atualizada

Mudancas pontuais apenas:

- Header: icone Bot + "Amelia CRM" / "Grupo Blue"
- Card title: "Bem-vindo ao Amelia CRM"
- CardDescription: "Acesse sua plataforma de inteligencia comercial"
- Footer: "(c) 2025 Grupo Blue"
- Remover tab de Cadastro (usuarios sao internos, criados via admin) — manter apenas Login e Esqueci Senha

---

## Parte 4: CSS — Animacao float

Adicionar um unico keyframe novo ao `index.css` para os circulos decorativos da home:

```css
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
}
.animate-float {
  animation: float 6s ease-in-out infinite;
}
```

---

## Resumo de arquivos

| Arquivo | Acao |
|---------|------|
| `index.html` | Editar — meta tags |
| `src/pages/Index.tsx` | Reescrever — nova home |
| `src/pages/Auth.tsx` | Editar — rebranding + remover tab signup |
| `src/components/layout/AppSidebar.tsx` | Editar — label |
| `src/components/layout/TopBar.tsx` | Editar — fallback title |
| `supabase/functions/copilot-chat/index.ts` | Editar — system prompt |
| `src/index.css` | Editar — keyframe float + comentario |

Nenhum componente novo. Nenhuma dependencia nova. Tudo com classes CSS existentes + 1 keyframe adicional.
