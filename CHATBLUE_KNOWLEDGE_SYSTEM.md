# ChatBlue — Estudo Completo do Sistema

> Documento gerado a partir de uma análise completa do repositório ChatBlue, cobrindo arquitetura, stack tecnológica, banco de dados, serviços, rotas, IA/ML e infraestrutura.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Estrutura do Projeto](#3-estrutura-do-projeto)
4. [Schema do Banco de Dados (Prisma)](#4-schema-do-banco-de-dados-prisma)
5. [Rotas da API](#5-rotas-da-api)
6. [Arquitetura da Camada de Serviços](#6-arquitetura-da-camada-de-serviços)
7. [Sistema de IA e Knowledge Base](#7-sistema-de-ia-e-knowledge-base)
8. [Sistema de Machine Learning](#8-sistema-de-machine-learning)
9. [Integração WhatsApp](#9-integração-whatsapp)
10. [Configuração de Ambiente](#10-configuração-de-ambiente)
11. [Scripts de Desenvolvimento](#11-scripts-de-desenvolvimento)
12. [Infraestrutura e Deploy](#12-infraestrutura-e-deploy)
13. [CI/CD](#13-cicd)
14. [Arquivos Críticos](#14-arquivos-críticos)

---

## 1. Visão Geral

**ChatBlue** é uma plataforma multi-tenant de atendimento ao cliente via WhatsApp com assistência de IA. Construído como um **monorepo** usando **pnpm workspaces** e **Turbo** para orquestração de build.

### Funcionalidades Principais

- **Multi-tenancy** com isolamento completo de dados por empresa
- **Múltiplas conexões WhatsApp** (Baileys + Meta Cloud API)
- **Agente de IA** com capacidade de transferência para humano
- **Hierarquia de departamentos** com roteamento de tickets
- **Gestão de SLA** e rastreamento de métricas
- **Integração com Notion** para verificação de clientes
- **Sistema de NPS** e avaliação de atendimento
- **Classificação de intenção por ML**
- **Comunicação em tempo real** via WebSockets
- **Sistema de campanhas** para envio em massa
- **Kanban** para visualização de tickets
- **Web Push Notifications**

---

## 2. Stack Tecnológica

### Frontend (Next.js 14)

| Categoria | Tecnologia |
|-----------|-----------|
| Framework | Next.js 14 (App Router) + TypeScript |
| Estilização | Tailwind CSS + PostCSS |
| Componentes UI | Shadcn/UI + Radix UI (10+ componentes) |
| Estado | Zustand |
| Data Fetching | React Query (@tanstack/react-query) |
| Tempo Real | Socket.io-client |
| Formulários | React Hook Form + Zod |
| Drag & Drop | @hello-pangea/dnd |
| Ícones | Lucide React |

**~40 arquivos de componentes (.tsx)**

### Backend (Express + Node.js)

| Categoria | Tecnologia |
|-----------|-----------|
| Framework | Express.js + TypeScript |
| Banco de Dados | PostgreSQL 16 + Prisma ORM |
| Cache/Filas | Redis + BullMQ |
| Tempo Real | Socket.io |
| WhatsApp (Unofficial) | Baileys (7.0.0-rc.9) |
| WhatsApp (Official) | Meta Cloud API |
| IA — OpenAI | @openai (4.24.1) |
| IA — Anthropic | @anthropic-ai/sdk (0.71.2) |
| Notion | @notionhq/client (2.2.14) |
| Email | Brevo (@getbrevo/brevo 3.0.1) |
| Push | web-push (VAPID) |
| Segurança | Bcrypt, JWT, Helmet, CORS, Rate Limiting |
| Arquivos | Multer, PDF Parse, Mammoth |
| Logging | Pino + Pino Pretty |
| Testes | Vitest + Supertest |

**~114 arquivos TypeScript**

### Infraestrutura

| Categoria | Tecnologia |
|-----------|-----------|
| Package Manager | pnpm 8.12.0+ |
| Build Tool | Turbo 2.0.0 |
| Containerização | Docker + Docker Compose |
| Banco de Dados | PostgreSQL 16 |
| Cache | Redis 7 |
| Node | 18+ |

---

## 3. Estrutura do Projeto

```
chatblue/
├── apps/
│   ├── api/                              # Backend (~114 TS files)
│   │   ├── src/
│   │   │   ├── config/                   # DB, Redis, Logger config
│   │   │   ├── routes/                   # 29 arquivos de rotas
│   │   │   ├── services/                 # Lógica de negócio
│   │   │   │   ├── ai/                   # Orquestração de IA (11 arquivos)
│   │   │   │   ├── whatsapp/             # Baileys, Meta Cloud
│   │   │   │   ├── ml/                   # ML: intenção, padrões (6 arquivos)
│   │   │   │   ├── knowledge/            # Sync e retrieval de conhecimento
│   │   │   │   ├── notion/               # Integração Notion
│   │   │   │   ├── sla/                  # Cálculos de SLA
│   │   │   │   ├── email/                # Serviço de email
│   │   │   │   ├── push/                 # Push notifications
│   │   │   │   ├── nps/                  # Pesquisas NPS
│   │   │   │   ├── upload/               # Upload de arquivos
│   │   │   │   ├── blue/                 # Mascote Blue
│   │   │   │   ├── instagram/            # Suporte Instagram
│   │   │   │   ├── external-ai/          # Integração IA externa
│   │   │   │   └── ...outros serviços
│   │   │   ├── jobs/                     # Jobs assíncronos (BullMQ)
│   │   │   ├── sockets/                  # Handlers Socket.io
│   │   │   ├── middlewares/              # Auth, tenant, error handling
│   │   │   └── utils/
│   │   ├── prisma/
│   │   │   ├── schema.prisma             # 1.652 linhas — 45+ modelos
│   │   │   ├── migrations/               # 17 arquivos de migração
│   │   │   └── seed.ts                   # Script de seed
│   │   └── package.json                  # 51 dependências
│   │
│   └── web/                              # Frontend (~40 componentes)
│       ├── app/
│       │   ├── (auth)/                   # Login, registro, recuperação
│       │   ├── (dashboard)/              # Área autenticada
│       │   │   ├── chat/                 # Interface de chat
│       │   │   ├── contacts/             # Gestão de contatos
│       │   │   ├── connections/          # Configuração WhatsApp
│       │   │   ├── metrics/              # Analytics & SLA
│       │   │   ├── settings/             # Configurações admin
│       │   │   ├── ai-agents/            # Configuração agentes IA
│       │   │   ├── knowledge*/           # Gestão da base de conhecimento
│       │   │   ├── kanban/               # Visualização Kanban
│       │   │   ├── inbox/                # Caixa de entrada
│       │   │   └── users/                # Gestão de usuários
│       │   ├── nps/[token]               # Pesquisa NPS (público)
│       │   └── rate/[token]              # Avaliação (público)
│       ├── components/
│       │   ├── chat/                     # Componentes de chat
│       │   ├── inbox/                    # Componentes inbox
│       │   ├── kanban/                   # Componentes kanban
│       │   ├── layout/                   # Layout
│       │   ├── blue/                     # Mascote Blue
│       │   ├── ui/                       # Primitivos Shadcn/Radix
│       │   ├── shared/                   # Componentes compartilhados
│       │   └── providers/                # Context providers
│       ├── stores/                       # Zustand (auth, chat)
│       ├── lib/                          # API client, utilitários
│       └── package.json                  # 45 dependências
│
├── docker/
│   ├── docker-compose.yml                # Dev local
│   ├── docker-compose.prod.yml           # Produção
│   ├── docker-compose.local.yml          # Alternativo local
│   ├── docker-compose.swarm.yml          # Docker Swarm
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   ├── nginx/
│   └── entrypoint-api.sh
│
├── deploy/                               # 40+ scripts de deploy
│   ├── backup.sh
│   ├── auto-install.py
│   ├── build-web.sh
│   ├── apply-migrations.sh
│   ├── chatblue-nginx.conf
│   └── ...mais scripts
│
├── docs/                                 # 18+ arquivos de documentação
│
├── .github/workflows/                    # Pipelines CI/CD
│
├── package.json                          # Root do monorepo
├── pnpm-workspace.yaml                   # Configuração workspace
├── turbo.json                            # Configuração Turbo
└── .env.example                          # 94 variáveis de ambiente
```

---

## 4. Schema do Banco de Dados (Prisma)

**45+ modelos** organizados por domínio:

### Modelos Core

| Modelo | Descrição |
|--------|-----------|
| `Company` | Organização multi-tenant |
| `User` | Membros da equipe |
| `UserCompany` | Relação usuário-empresa |
| `Department` | Departamentos da organização |
| `UserDepartment` | Atribuição usuário-departamento |

### Modelos de Mensageria

| Modelo | Descrição |
|--------|-----------|
| `WhatsAppConnection` | Conexões de conta WhatsApp |
| `Contact` | Contatos de clientes |
| `Ticket` | Tickets de suporte |
| `Message` | Mensagens do chat |
| `TicketTransfer` | Histórico de transferências |
| `CampaignDispatch` | Campanhas de mensagens em massa |

### Modelos de IA & Conhecimento

| Modelo | Descrição |
|--------|-----------|
| `AIAssistant` | Configuração do agente de IA |
| `AIDocument` | Documentos de conhecimento |
| `AIDataSource` | Fontes de dados para treinamento |
| `AIAgentDataSource` | Mapeamento agente-IA para fonte |
| `AIAutoSuggestion` | Respostas sugeridas |
| `AISentimentAnalysis` | Dados de sentimento |
| `AIQuerySource` | Rastreamento de consultas |
| `AIKnowledgeGap` | Lacunas de conhecimento |

### Modelos de Machine Learning

| Modelo | Descrição |
|--------|-----------|
| `MLIntentPattern` | Padrões de classificação de intenção |
| `MLTrainingPair` | Pares de treinamento |
| `MLResponseTemplate` | Templates de resposta |
| `MLModelVersion` | Versionamento de modelos |
| `MLLearningMetric` | Métricas de performance |
| `MLAIDecisionLog` | Log de decisões da IA |
| `MLTrainingBatch` | Processamento em lote |

### Modelos de Negócio

| Modelo | Descrição |
|--------|-----------|
| `SLAConfig` | Regras e limites de SLA |
| `MetricGoal` | Metas de performance |
| `MetricAlert` | Alertas de métricas |
| `Activity` | Log de auditoria (20+ tipos) |
| `EmailAlertLog` | Rastreamento de alertas por email |

### Modelos de Funcionalidades

| Modelo | Descrição |
|--------|-----------|
| `KnowledgeBase` | Artigos de conhecimento |
| `FAQ` | Entradas de FAQ |
| `PredefinedMessage` | Mensagens predefinidas |
| `BlueInteraction` | Interações do mascote Blue |
| `Notification` | Notificações in-app |
| `CompanySettings` | Configurações da organização |

### Enums Principais

| Enum | Valores |
|------|---------|
| `Plan` | BASIC, PRO, ENTERPRISE |
| `UserRole` | SUPER_ADMIN, ADMIN, SUPERVISOR, AGENT |
| `ConnectionType` | BAILEYS, META_CLOUD, INSTAGRAM |
| `ConnectionStatus` | DISCONNECTED, CONNECTING, CONNECTED, BANNED, ERROR |
| `TicketStatus` | PENDING, IN_PROGRESS, WAITING, SNOOZED, RESOLVED, CLOSED |
| `Priority` | LOW, MEDIUM, HIGH, URGENT |
| `TransferType` | 4 tipos de transferência |
| `MessageType` | TEXT, IMAGE, VIDEO, AUDIO, DOCUMENT, STICKER, LOCATION, CONTACT, TEMPLATE, INTERACTIVE, SYSTEM, REACTION |
| `ActivityType` | 20+ tipos de atividade |

---

## 5. Rotas da API

**29 arquivos de rota** cobrindo toda a funcionalidade:

| Rota | Propósito | Endpoints Principais |
|------|-----------|---------------------|
| `auth.routes.ts` | Autenticação | login, register, refresh token, logout |
| `user.routes.ts` | Gestão de usuários | CRUD users, profile, preferences |
| `company.routes.ts` | Gestão de empresas | Operações de tenant |
| `department.routes.ts` | Hierarquia de departamentos | CRUD departamentos, regras de roteamento |
| `connection.routes.ts` | Conexões WhatsApp | Connect Baileys/Meta, QR code, status |
| `ticket.routes.ts` | Sistema de tickets | Criar, atualizar, transferir, fechar tickets |
| `message.routes.ts` | Mensageria | Enviar, receber, buscar mensagens |
| `contact.routes.ts` | Gestão de contatos | Adicionar, atualizar, segmentar contatos |
| `metrics.routes.ts` | Analytics | SLA, tempo de resposta, métricas de resolução |
| `ai-assistant.routes.ts` | Agente IA | Configurar, testar, consultar IA |
| `ai.routes.ts` | Serviço de IA | Treinar, sugerir, personalizar |
| `knowledge*.routes.ts` | Gestão de conhecimento | Criar, sincronizar, recuperar knowledge |
| `ml-learning.routes.ts` | Treinamento ML | Padrões de intenção, respostas, métricas |
| `faq.routes.ts` | Gestão de FAQ | CRUD artigos FAQ |
| `chat-search.routes.ts` | Busca de mensagens | Full-text search |
| `webhook.routes.ts` | Webhooks | Handlers de webhooks recebidos |
| `notification.routes.ts` | Notificações | Push, email, alertas in-app |
| `upload.routes.ts` | Upload de arquivos | Upload e processamento de mídia |
| `push.routes.ts` | Push notifications | Configuração e envio web push |
| `sgt.routes.ts` | Integração SGT externa | Sincronização com sistema SGT |
| `webform.routes.ts` | Integração com web forms | Processamento de formulários |
| `settings.routes.ts` | Configurações | Configurações globais e por empresa |
| `predefined-messages.routes.ts` | Templates | CRUD templates de mensagem |
| `campaign-dispatch.routes.ts` | Campanhas | Envio de mensagens em massa |
| `nps.routes.ts` | Pesquisas NPS | Coleta de dados NPS |
| `external.routes.ts` | APIs externas | Integrações de terceiros |
| `external-ai.routes.ts` | IA externa | Integração Claude, OpenAI |
| `blue.routes.ts` | Mascote Blue | Configuração do mascote |
| `public.routes.ts` | Endpoints públicos | Sem autenticação necessária |

---

## 6. Arquitetura da Camada de Serviços

### Serviços de IA (11 arquivos)

| Serviço | Função |
|---------|--------|
| `ai.service.ts` | Orquestração principal de IA |
| `assistant.service.ts` | Consultas e feedback do assistente IA |
| `orchestrator.service.ts` | Orquestração multi-agente |
| `context-builder.service.ts` | Construção de contexto da conversa |
| `data-source-sync.service.ts` | Sincronização de fontes de dados externas |
| `embedding.service.ts` | Embeddings vetoriais (Claude/OpenAI) |
| `guardrails.service.ts` | Validação de conteúdo e segurança |
| `knowledge-sync.service.ts` | Sincronização da base de conhecimento |
| `personality.service.ts` | Configuração de personalidade da IA |
| `transfer-analyzer.service.ts` | Análise de necessidade de transferência humana |
| `transcription.service.ts` | Transcrição de áudio |

### Serviços WhatsApp (3 arquivos)

| Serviço | Função |
|---------|--------|
| `baileys.service.ts` | Conexão WhatsApp não-oficial (79KB — maior arquivo) |
| `meta-cloud.service.ts` | API oficial Meta Cloud |
| `whatsapp.service.ts` | Abstração de conexão |

### Serviços de Machine Learning (6 arquivos)

| Serviço | Função |
|---------|--------|
| `intent-classifier.service.ts` | Classificar intenção do usuário |
| `pattern-detector.service.ts` | Detectar padrões de interação |
| `ml-response-generator.service.ts` | Gerar respostas contextuais |
| `quality-scorer.service.ts` | Pontuar qualidade das respostas |
| `training-pair-collector.service.ts` | Coletar dados de treinamento |
| `ml-integration.service.ts` | Integração do pipeline ML |

### Outros Serviços Críticos

| Serviço | Função |
|---------|--------|
| `message-processor.service.ts` | Processamento de mensagens (90KB) |
| `outbound-webhook.service.ts` | Envio de notificações webhook |
| `notion.service.ts` | Integração com Notion |
| `email.service.ts` | Envio de emails (Brevo) |
| `nps.service.ts` | Pesquisas NPS |
| `sla.service.ts` | Cálculos de SLA |
| `knowledge.service.ts` | Gestão de base de conhecimento |
| `upload.service.ts` | Upload de arquivos |
| `instagram.service.ts` | Suporte Instagram |

---

## 7. Sistema de IA e Knowledge Base

### Arquitetura RAG (Retrieval-Augmented Generation)

O sistema de IA do ChatBlue implementa um pipeline RAG completo:

```
Mensagem do Cliente
        │
        ▼
┌─────────────────┐
│ Context Builder  │ ← Histórico de conversa + dados do contato
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Embeddings    │ ← Busca semântica na base de conhecimento
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Guardrails    │ ← Validação de segurança e conteúdo
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Orchestrator   │ ← Decisão: responder, escalar ou transferir
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLM Provider   │ ← OpenAI ou Anthropic (Claude)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Transfer Analyzer│ ← Análise se precisa de humano
└────────┬────────┘
         │
         ▼
    Resposta Final
```

### Componentes do Sistema de Conhecimento

1. **AIDocument** — Documentos processados com embeddings vetoriais
2. **AIDataSource** — Fontes externas (Notion, uploads, etc.)
3. **KnowledgeBase** — Artigos internos de conhecimento
4. **FAQ** — Perguntas frequentes indexadas
5. **AIKnowledgeGap** — Lacunas identificadas automaticamente

### Providers de IA Suportados

- **OpenAI** (GPT-4, GPT-3.5-turbo) — via `@openai` SDK
- **Anthropic** (Claude) — via `@anthropic-ai/sdk`
- Configurável por empresa via variável `AI_DEFAULT_MODEL`

---

## 8. Sistema de Machine Learning

O ChatBlue possui uma **camada de ML própria** que aprende com as interações:

### Pipeline de ML

```
Interação do Usuário
        │
        ├──► Intent Classifier ──► Classificação de Intenção
        │
        ├──► Pattern Detector ──► Detecção de Padrões
        │
        ├──► Quality Scorer ──► Pontuação de Qualidade
        │
        └──► Training Pair Collector ──► Coleta de Dados
                                              │
                                              ▼
                                    ML Response Generator
                                              │
                                              ▼
                                    Respostas Aprimoradas
```

### Modelos de Dados ML

| Modelo | Função |
|--------|--------|
| `MLIntentPattern` | Padrões para classificação de intenção |
| `MLTrainingPair` | Pares pergunta-resposta para treinamento |
| `MLResponseTemplate` | Templates de resposta gerados por ML |
| `MLModelVersion` | Controle de versão dos modelos |
| `MLLearningMetric` | Métricas de performance do aprendizado |
| `MLAIDecisionLog` | Log de todas as decisões da IA |
| `MLTrainingBatch` | Processamento de treinamento em lote |

### Funcionalidades ML

- **Classificação de Intenção**: Identifica automaticamente o que o cliente deseja
- **Detecção de Padrões**: Reconhece padrões recorrentes de interação
- **Geração de Respostas**: Produz respostas contextuais baseadas em aprendizado
- **Scoring de Qualidade**: Avalia a qualidade de cada resposta
- **Aprendizado Contínuo**: Sistema aprende com cada interação para melhorar

---

## 9. Integração WhatsApp

### Suporte Dual

| Método | Biblioteca | Uso |
|--------|-----------|-----|
| **Baileys** | baileys@7.0.0-rc.9 | Conexão não-oficial, flexível |
| **Meta Cloud API** | API REST oficial | Conexão oficial, escalável |
| **Instagram** | Meta Graph API | Suporte a DMs do Instagram |

### Fluxo de Mensagem

```
WhatsApp/Instagram
        │
        ▼
┌──────────────────┐
│ Baileys / Meta   │  ← Recebe mensagem
│ Cloud Service    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Message Processor│  ← Processa e roteia (90KB de lógica)
│   Service        │
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
 Ticket    Socket.io
 System    (real-time)
    │         │
    ▼         ▼
  Agent    Frontend
  ou IA    Atualiza
```

### Status de Mensagem

Rastreamento completo: `PENDING → SENT → DELIVERED → READ → FAILED → RECEIVED`

### Status de Conexão

`DISCONNECTED → CONNECTING → CONNECTED → BANNED → ERROR`

---

## 10. Configuração de Ambiente

**94 variáveis de ambiente** organizadas por categoria:

### Banco de Dados
```env
DATABASE_URL=postgresql://user:password@localhost:5432/chatblue
```

### Redis
```env
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
```

### Autenticação (JWT)
```env
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=
```

### Email (Brevo)
```env
BREVO_API_KEY=
EMAIL_FROM=
```

### Notificações Push (VAPID)
```env
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

### Notion
```env
NOTION_API_KEY=
NOTION_DATABASE_ID=
```

### Inteligência Artificial
```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
AI_DEFAULT_MODEL=
```

### Meta WhatsApp (API Oficial)
```env
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
META_PHONE_NUMBER_ID=
```

### Arquivos
```env
MAX_FILE_SIZE=
UPLOADS_DIR=
```

### Segurança
```env
ENCRYPTION_KEY=
```

---

## 11. Scripts de Desenvolvimento

### Scripts do Monorepo (raiz)

```bash
pnpm dev           # Inicia todos os apps em modo watch
pnpm build         # Compila todos os apps
pnpm start         # Inicia servidores de produção
pnpm lint          # Lint de todo o código
pnpm test          # Executa testes
pnpm db:generate   # Gera client Prisma
pnpm db:push       # Sincroniza schema do DB
pnpm db:migrate    # Executa migrações
pnpm db:studio     # Abre Prisma Studio
pnpm clean         # Limpa todos os builds
pnpm format        # Formata código com Prettier
```

### Configuração Turbo

| Task | Descrição | Cache |
|------|-----------|-------|
| `build` | Compila todos os apps | Outputs: `.next/**`, `dist/**` |
| `dev` | Modo watch de desenvolvimento | Sem cache, persistente |
| `start` | Inicia em produção | Depende de build |
| `lint` | Lint de todo código | Cacheável |
| `test` | Executa suítes de teste | Cacheável |
| `db:generate` | Codegen Prisma | Cacheável |
| `db:push` | Sincroniza schema | Sem cache |
| `db:migrate` | Executa migrações | Sem cache |
| `clean` | Limpa outputs | Sem cache |

---

## 12. Infraestrutura e Deploy

### Docker Compose — Variantes

| Arquivo | Uso |
|---------|-----|
| `docker-compose.yml` | Desenvolvimento (PostgreSQL 16, Redis 7) |
| `docker-compose.prod.yml` | Produção |
| `docker-compose.local.yml` | Setup local alternativo |
| `docker-compose.swarm.yml` | Deploy com Docker Swarm |

### Dockerfiles

- `Dockerfile.api` — Build da API (Node.js)
- `Dockerfile.web` — Build do frontend (Next.js)

### Scripts de Deploy

**40+ scripts** no diretório `deploy/` incluindo:

- `backup.sh` — Backup do banco de dados
- `auto-install.py` — Instalação automatizada
- `build-web.sh` — Build do frontend
- `apply-migrations.sh` — Aplicação de migrações
- `chatblue-nginx.conf` — Configuração Nginx reverse proxy

---

## 13. CI/CD

### GitHub Actions Workflows

| Workflow | Propósito |
|----------|-----------|
| `ci.yml` | Testes, linting, verificação de build |
| `build-push-dev.yml` | Build e push de imagens Docker (dev) |
| `build-push-prod.yml` | Build e push de imagens Docker (produção) |

---

## 14. Arquivos Críticos

### Backend — Arquivos Chave

| Arquivo | Descrição | Tamanho |
|---------|-----------|---------|
| `apps/api/src/server.ts` | Entry point do servidor | — |
| `apps/api/prisma/schema.prisma` | Schema completo do banco | 1.652 linhas |
| `apps/api/src/services/message-processor.service.ts` | Processamento de mensagens | ~90KB |
| `apps/api/src/services/whatsapp/baileys.service.ts` | Integração Baileys | ~79KB |
| `apps/api/src/services/ai/orchestrator.service.ts` | Orquestração de IA | — |
| `apps/api/src/services/ai/context-builder.service.ts` | Construção de contexto | — |
| `apps/api/src/services/ai/guardrails.service.ts` | Segurança da IA | — |

### Frontend — Arquivos Chave

| Arquivo | Descrição |
|---------|-----------|
| `apps/web/app/(dashboard)/chat/` | Interface principal de chat |
| `apps/web/stores/chat.store.ts` | Gerenciamento de estado do chat (Zustand) |
| `apps/web/stores/auth.store.ts` | Gerenciamento de estado de autenticação |
| `apps/web/lib/api.ts` | Cliente HTTP da API |

### Configuração

| Arquivo | Descrição |
|---------|-----------|
| `turbo.json` | Orquestração de build |
| `pnpm-workspace.yaml` | Definição do workspace |
| `.env.example` | 94 variáveis de ambiente documentadas |

---

## Padrões e Decisões Arquiteturais

### Multi-Tenancy
- Middleware de tenant isola dados por empresa
- Controle de acesso por role: `SUPER_ADMIN → ADMIN → SUPERVISOR → AGENT`

### Comunicação em Tempo Real
- **Socket.io** para chat ao vivo, notificações e presença
- **BullMQ** job queues para processamento assíncrono

### Segurança
- JWT com refresh tokens
- Bcrypt para hash de senhas
- Helmet para headers HTTP
- CORS configurável
- Rate limiting por endpoint
- Encryption key para dados sensíveis

### Organização do Monorepo
- **Turbo** para orquestração eficiente de tasks
- **pnpm workspaces** para gestão de dependências
- Separação clara entre `apps/api` e `apps/web`
- Potencial para pacotes compartilhados em `packages/`
