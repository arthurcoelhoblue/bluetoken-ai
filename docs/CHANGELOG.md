# 📋 CHANGELOG - SDR IA

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [5.0.0] - 2025-12-08

### 🎯 PATCH 5A - Infraestrutura de Mensagens

#### Adicionado
- Tabela `message_templates` para templates de mensagens por empresa/canal
- Tabela `lead_contacts` para cache de contatos dos leads
- Edge function `cadence-runner` para executar cadências vencidas
- Tipos TypeScript (`src/types/messaging.ts`)
- 10 templates seed (5 Tokeniza + 5 Blue)
- Sistema de lock otimista para evitar duplicação de disparos
- Resolução de placeholders: `{{nome}}`, `{{primeiro_nome}}`, `{{email}}`, `{{empresa}}`
- Tratamento de erros com retry automático (15-30min)

#### Alterado
- `sgt-webhook` agora faz upsert em `lead_contacts` ao receber eventos

#### Técnico
- Disparo mockado (preparado para integração real no PATCH 5B)
- Lotes de até 50 runs por execução

---

## [4.0.0] - 2025-12-08

### 🎯 PATCH 4 - Motor de Cadências

#### Adicionado
- Tabelas: `cadences`, `cadence_steps`, `lead_cadence_runs`, `lead_cadence_events`
- Enums: `cadence_run_status`, `cadence_event_tipo`, `canal_tipo`
- Tipos TypeScript (`src/types/cadence.ts`)
- 4 cadências seed: TOKENIZA_INBOUND_LEAD_NOVO, TOKENIZA_MQL_QUENTE, BLUE_INBOUND_LEAD_NOVO, BLUE_IR_URGENTE
- Função `decidirCadenciaParaLead()` e `iniciarCadenciaParaLead()`
- Integração: classificação → cadência automática no webhook
- Logs de eventos de cadência (AGENDADO)
- Máximo 1 run ativa por lead+empresa

---

## [3.0.0] - 2025-12-08

### 🎯 PATCH 3 - Pipeline de Classificação Comercial

#### Adicionado
- Tabela `lead_classifications` para armazenar classificações
- Enums: `temperatura_tipo`, `icp_tipo`, `persona_tipo`
- Tipos TypeScript para classificação (`src/types/classification.ts`)
- Lógica completa de classificação na edge function `sgt-webhook`
- Regras de ICP para Tokeniza (Serial, Médio Prazo, Emergente, Alto Volume Digital)
- Regras de ICP para Blue (Alto Ticket IR, Recorrente, Perdido Recuperável)
- Personas por empresa e ICP
- Cálculo de temperatura por evento e stage
- Cálculo de prioridade (1, 2, 3)
- Score interno consolidado (0-100)
- Upsert por (lead_id, empresa) para evitar duplicatas

#### Segurança
- RLS policies para Admins, Marketing e SDR_IA
- Service role para operações de insert/update

---

## [2.0.0] - 2025-12-08

### 🎯 PATCH 2 - Webhook SGT

#### Adicionado
- Edge function `sgt-webhook` para receber eventos do SGT
- Tabela `sgt_events` para armazenar eventos brutos
- Tabela `sgt_event_logs` para auditoria
- Enums: `sgt_evento_tipo`, `empresa_tipo`, `sgt_event_status`
- Tipos TypeScript para payload SGT (`src/types/sgt.ts`)
- Validação HMAC SHA-256 para segurança
- Sistema de idempotência (evita duplicatas)
- Normalizador de dados SGT
- Stub do pipeline de classificação

#### Segurança
- RLS policies para acesso admin às tabelas de eventos
- Validação de assinatura via header `x-sgt-signature`
- Validação de timestamp para evitar replay attacks

---

## [1.0.0] - 2025-12-08

### 🎯 PATCH 1 - Autenticação Google + RBAC

#### Adicionado
- Autenticação via Google OAuth
- Tabela `profiles` para dados de usuário
- Tabela `user_roles` para papéis
- Enum `user_role`: ADMIN, CLOSER, MARKETING, AUDITOR, READONLY, SDR_IA
- Sistema de permissões por papel
- Componente `ProtectedRoute` para proteção de rotas
- Componente `RoleBadge` para exibição visual de papéis
- Páginas: Auth, Me, Unauthorized, Index
- Design system corporativo

#### Segurança
- Primeiro usuário é automaticamente ADMIN
- Demais usuários recebem READONLY
- RLS policies em todas as tabelas
- Funções `has_role()` e `get_user_roles()` com SECURITY DEFINER

---

## Legenda

- 🎯 **Patch** - Grupo de funcionalidades relacionadas
- ➕ **Adicionado** - Novas funcionalidades
- 🔄 **Alterado** - Mudanças em funcionalidades existentes
- 🗑️ **Removido** - Funcionalidades removidas
- 🐛 **Corrigido** - Correções de bugs
- 🔒 **Segurança** - Melhorias de segurança
