

# Corrigir Wiki para funcionar na UI do sistema

## Problemas identificados

1. **Admonitions do Docusaurus nao renderizam**: Os arquivos markdown usam sintaxe `:::info`, `:::warning`, `:::tip` (encontrada em 34 arquivos, 183 ocorrencias). O react-markdown nao suporta essa sintaxe, entao o conteudo aparece como texto puro com ":::" visivel.

2. **Links relativos quebrados**: Os markdowns usam links como `[Meu Dia](./meu-dia)` que sao padrao Docusaurus. Na wiki atual, a navegacao usa query params (`?page=vendedor/meu-dia`), entao esses links nao funcionam.

## Solucao

### 1. Plugin de admonitions para react-markdown

Criar um processador que converte a sintaxe `:::tipo` em blocos HTML estilizados antes de passar para o ReactMarkdown. Isso transforma:

```text
:::info Titulo
Conteudo aqui
:::
```

Em cards estilizados com icone e cor correspondente (azul para info, amarelo para warning, verde para tip, vermelho para danger).

### 2. Processador de links relativos

Criar uma funcao que converte links Docusaurus relativos (`./meu-dia`, `../admin/benchmark`) nos links corretos da wiki (`?page=vendedor/meu-dia`). Aplicar como componente customizado de link no ReactMarkdown.

### 3. Ajuste de layout

Remover o `h-[calc(100vh-3.5rem)]` que pode conflitar com o AppLayout (que ja gerencia a altura do conteudo), usando `h-full` para preencher o espaco disponivel corretamente.

## Detalhes tecnicos

### Arquivos alterados

| Arquivo | Acao |
|---------|------|
| `src/config/wikiContent.ts` | Alterar - adicionar funcao `processContent()` que converte admonitions `:::tipo` em HTML/markdown estilizado |
| `src/pages/WikiPage.tsx` | Alterar - passar componentes customizados ao ReactMarkdown (link handler, admonition blocks), ajustar layout |
| `src/components/wiki/WikiSidebar.tsx` | Sem alteracao (ja esta correto) |

### Processamento de admonitions

A funcao `processContent()` em `wikiContent.ts` vai:
- Usar regex para encontrar blocos `:::tipo Titulo\n...conteudo...\n:::`
- Converter em blocos markdown com HTML inline que o react-markdown renderiza como cards coloridos
- Mapear tipos para estilos: info (azul), warning (amarelo), tip (verde), note (cinza), danger (vermelho)

### Links customizados no ReactMarkdown

No `WikiPage.tsx`, passar um componente `a` customizado ao ReactMarkdown que:
- Detecta links relativos (comecam com `./` ou `../`)
- Resolve o caminho relativo baseado no slug atual da pagina
- Converte para navegacao interna via `onSelect(resolvedSlug)`
- Mantem links externos funcionando normalmente

