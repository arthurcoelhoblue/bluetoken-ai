# BlueToken AI — CRM Inteligente

CRM com SDR IA integrada, gestão de pipeline, cadências automatizadas e módulo de Customer Success para as empresas Blue e Tokeniza.

## Arquitetura

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Lovable Cloud (Supabase) — PostgreSQL + Edge Functions (Deno) |
| IA | Lovable AI (Gemini / GPT) via Edge Functions |
| Autenticação | Supabase Auth com RBAC customizado |
| Realtime | Supabase Realtime (Kanban, notificações) |

## Estrutura do Projeto

```
src/
├── components/     # Componentes React organizados por domínio
├── contexts/       # AuthContext, CompanyContext, ThemeContext
├── hooks/          # Custom hooks (queries, mutations, lógica de negócio)
├── pages/          # Páginas da aplicação (rotas)
├── schemas/        # Validação Zod para formulários
├── types/          # Interfaces TypeScript
├── lib/            # Utilitários e lógica pura
└── integrations/   # Cliente Supabase (auto-gerado)

supabase/
├── functions/      # 46 Edge Functions (webhooks, IA, automações)
│   └── _shared/    # Módulos compartilhados (CORS, AI provider, logger)
└── migrations/     # Migrações SQL do banco
```

## Módulos Principais

- **Pipeline / Kanban** — gestão visual de negócios com drag & drop
- **SDR IA** — classificação de intenção, geração de resposta, qualificação automática
- **Cadências** — motor de follow-up multicanal (WhatsApp, e-mail)
- **Customer Success** — health score, NPS, playbooks, alertas de churn
- **Gamificação** — pontos, badges, leaderboard para vendedores
- **Analytics** — funil, conversão, esforço por canal, projeções
- **Copilot** — assistente IA contextual por deal/lead

## Como Rodar Localmente

```bash
# 1. Clone o repositório
git clone <URL_DO_REPO>
cd <NOME_DO_PROJETO>

# 2. Instale as dependências
npm install

# 3. Configure variáveis de ambiente
# O arquivo .env é gerado automaticamente pelo Lovable Cloud.
# Para desenvolvimento local, crie .env com:
#   VITE_SUPABASE_URL=<url>
#   VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

## Testes

```bash
npm run test        # Roda todos os testes com Vitest
```

## Versionamento

O projeto segue [Semantic Versioning](https://semver.org/). Versão atual: **1.0.0**.

Changelog detalhado em `docs/CHANGELOG.md`.
