

# Documentacao Wiki no endereco /wiki

## Contexto

O projeto possui um site Docusaurus em `docs-site/` com documentacao organizada por perfil (Vendedor, CS, Gestor, Admin, Desenvolvedor). Porem, o Docusaurus e um projeto separado com build proprio e nao roda dentro do Vite/React. A solucao e criar uma pagina Wiki nativa no React que renderiza o conteudo markdown dos docs diretamente na aplicacao.

## Implementacao

### 1. Instalar dependencia: `react-markdown`

Pacote leve para renderizar conteudo Markdown dentro de componentes React.

### 2. Novo componente: `src/pages/WikiPage.tsx`

Pagina completa de wiki com:
- Sidebar com navegacao por secao (Vendedor, CS, Gestor, Admin, Desenvolvedor)
- Area principal que exibe o conteudo da pagina selecionada
- Carrega os arquivos `.md` do diretorio `docs-site/docs/` via import raw
- Estilizacao com Tailwind (prose) para renderizacao limpa do markdown
- Busca simples por titulo de pagina

### 3. Novo componente: `src/components/wiki/WikiLayout.tsx`

Layout com sidebar colapsavel contendo a arvore de navegacao dos docs, separada por grupo/perfil.

### 4. Novo componente: `src/components/wiki/WikiSidebar.tsx`

Sidebar com links para cada secao e pagina, usando a estrutura de pastas do docs-site como base.

### 5. Registro de conteudo: `src/config/wikiContent.ts`

Arquivo que mapeia as paginas de documentacao disponiveis com titulo, grupo e conteudo importado via `?raw`:

```text
import introMd from '../../docs-site/docs/intro.md?raw';
import guiaRapidoMd from '../../docs-site/docs/guia-rapido.md?raw';
// ... demais arquivos
```

### 6. Rota no App.tsx

Adicionar rota `/wiki/*` apontando para `WikiPage`, protegida por autenticacao (usuarios logados podem acessar a wiki).

### 7. Sidebar de navegacao principal

Adicionar item "Wiki" no grupo "Configuracao" do `AppSidebar.tsx` com icone `BookOpen` e URL `/wiki`.

Registrar a tela no `screenRegistry.ts` com key `wiki`.

Adicionar titulo no `TopBar.tsx` para a rota `/wiki`.

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/pages/WikiPage.tsx` | Novo |
| `src/components/wiki/WikiLayout.tsx` | Novo |
| `src/components/wiki/WikiSidebar.tsx` | Novo |
| `src/config/wikiContent.ts` | Novo |
| `src/App.tsx` | Alterar - adicionar rota /wiki |
| `src/components/layout/AppSidebar.tsx` | Alterar - adicionar item Wiki |
| `src/components/layout/TopBar.tsx` | Alterar - adicionar titulo Wiki |
| `src/config/screenRegistry.ts` | Alterar - registrar tela wiki |
| `package.json` | Alterar - adicionar react-markdown |

