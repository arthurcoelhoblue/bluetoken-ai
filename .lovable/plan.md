

# Docusaurus - Documentacao do Amelia CRM

## Objetivo

Criar um site de documentacao profissional usando Docusaurus dentro do repositorio atual (pasta `/docs-site`), com 5 visoes/perfis de usuario e conteudo pratico baseado nos manuais existentes.

## Estrutura do Projeto

```text
docs-site/
  docusaurus.config.ts
  package.json
  tsconfig.json
  sidebars.ts
  static/
    img/
      logo.svg
      favicon.ico
  src/
    css/
      custom.css
    pages/
      index.tsx          -- Landing page com cards por perfil
  docs/
    intro.md             -- Visao geral do sistema
    guia-rapido.md       -- Primeiros passos (todos os perfis)
    vendedor/
      index.md           -- Introducao vendedor
      meu-dia.md         -- Central de comando diaria
      pipeline.md        -- Funil de vendas
      deals.md           -- Detalhes de oportunidades
      cadencias.md       -- Follow-up automatico
      conversas.md       -- WhatsApp e BlueChat
      leads-quentes.md   -- Oportunidades prioritarias
      metas.md           -- Metas e comissoes
      telefonia.md       -- Click-to-call
      faq.md
    cs/
      index.md           -- Introducao CS
      dashboard.md       -- Metricas e visao geral
      clientes.md        -- Portfolio de clientes
      health-score.md    -- Calculo e interpretacao
      churn.md           -- Predicao de cancelamento
      pesquisas.md       -- NPS e CSAT
      incidencias.md     -- Deteccao e resolucao
      playbooks.md       -- Automacao de CS
      briefing.md        -- Briefing diario IA
      renovacoes.md      -- Gestao de renovacoes
      faq.md
    gestor/
      index.md           -- Introducao gestor
      cockpit.md         -- Painel estrategico
      analytics.md       -- Relatorios executivos
      pipelines-config.md -- Configuracao de funis
      usuarios.md        -- Gestao de acesso
      campos-custom.md   -- Campos customizados
      templates.md       -- Templates e regras
      performance.md     -- Analise de equipe
      faq.md
    admin/
      index.md           -- Introducao admin
      ia-config.md       -- Configuracoes da Amelia
      conhecimento.md    -- Base de conhecimento
      custos-ia.md       -- Monitoramento de custos
      benchmark.md       -- Benchmark de IA
      integracoes.md     -- Webhooks e integracoes
      importacao.md      -- Importacao de dados
      saude-operacional.md -- Health check
      cron-jobs.md       -- Automacao CRON
      multi-tenancy.md   -- Schemas e isolamento
      faq.md
    desenvolvedor/
      index.md           -- Arquitetura geral
      stack.md           -- React + Vite + Supabase
      edge-functions.md  -- Guia de edge functions
      rls.md             -- Politicas RLS e seguranca
      multi-tenancy.md   -- Schema views e provisioning
      sdr-ia.md          -- Motor SDR e IA
      cadence-engine.md  -- Motor de cadencias
      webhooks.md        -- Integracao via webhooks
      api-reference.md   -- Referencia de APIs
      testes.md          -- Estrategia de testes
      adr.md             -- Architecture Decision Records
```

## Implementacao

### 1. Configuracao base do Docusaurus

- Criar `docs-site/package.json` com Docusaurus 3.x
- `docusaurus.config.ts` com tema, navbar, footer, search
- Tema com cores da marca Blue CRM
- Navbar com links para cada visao

### 2. Sidebar organizada por perfil

Cada perfil tera uma sidebar propria com navegacao logica:
- **Vendedor**: Fluxo do dia a dia (Meu Dia -> Pipeline -> Deals -> Cadencias)
- **CS**: Fluxo de monitoramento (Dashboard -> Clientes -> Health -> Incidencias)
- **Gestor**: Fluxo estrategico (Cockpit -> Analytics -> Configuracao -> Equipe)
- **Admin**: Fluxo tecnico (IA -> Integracoes -> Importacao -> Operacional)
- **Desenvolvedor**: Fluxo arquitetural (Stack -> Edge Functions -> RLS -> APIs)

### 3. Conteudo migrado dos manuais v2

- Migrar conteudo dos 5 manuais em `docs/manuais_v2/` para a estrutura Docusaurus
- Quebrar cada manual em paginas menores e focadas (1 topico = 1 pagina)
- Adicionar admonitions do Docusaurus (:::tip, :::warning, :::info)
- Converter tabelas e dicas para formato Docusaurus

### 4. Secao Desenvolvedor (nova)

Conteudo novo baseado nos ADRs e patches existentes:
- Arquitetura do sistema (React + Supabase + Edge Functions)
- Guia de Edge Functions com exemplos reais do projeto
- Documentacao do multi-tenancy (Schema Views implementado no Bloco 4.1)
- Estrategia de RLS e seguranca
- Motor SDR-IA e cadencias
- Referencia de APIs e webhooks

### 5. Landing page

Pagina inicial com cards visuais para cada perfil, permitindo ao usuario escolher sua visao rapidamente.

## Detalhes Tecnicos

- **Docusaurus 3.x** com TypeScript
- Configurado como subprojeto independente (`docs-site/package.json`)
- Nao interfere no build do app principal (pasta separada)
- Adicionar `docs-site` ao `.gitignore` do build principal se necessario
- Para rodar localmente: `cd docs-site && npm install && npm start`
- Para build: `cd docs-site && npm run build`

## Escopo da primeira entrega

1. Estrutura Docusaurus configurada e funcional
2. Landing page com cards por perfil
3. Conteudo completo para **Vendedor** e **CS** (migrado dos manuais v2)
4. Conteudo completo para **Gestor** e **Admin** (migrado dos manuais v2)
5. Conteudo inicial para **Desenvolvedor** (arquitetura, multi-tenancy, edge functions)
6. Sidebar navegavel por perfil
7. Busca integrada (Docusaurus search local)

