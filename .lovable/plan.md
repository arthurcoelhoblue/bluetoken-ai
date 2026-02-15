
# Auditoria Completa do Sistema Amelia CRM (CORRIGIDO)

## Resumo Executivo

O sistema esta **funcionalmente completo e bem arquitetado**, com 35 edge functions, 95+ tabelas, modulos de CRM, CS, Gamificacao, Telefonia e IA operando em conjunto. Porem, a auditoria identificou **6 bugs reais**, **4 dados silenciosamente perdidos**, **8 melhorias recomendadas** e **3 funcionalidades desconectadas**.

---

## SECAO 1: BUGS REAIS (PRECISAM CORRECAO)

### BUG 1 - CRITICO: `next-best-action` consulta tabela inexistente
- **Arquivo**: `supabase/functions/next-best-action/index.ts`, linha 57
- **Problema**: Consulta `cadence_runs` que NAO existe no banco. A tabela correta e `deal_cadence_runs` ou `lead_cadence_runs`.
- **Impacto**: O `Promise.all` retorna array vazio para esse resultado, entao `cadence_active_count` e sempre 0. A IA nunca recebe informacao sobre cadencias ativas, prejudicando a qualidade das sugestoes.
- **Correcao**: Trocar `cadence_runs` por `deal_cadence_runs` e ajustar os campos selecionados.

### BUG 2 - MEDIO: `cs-playbook-runner` usa coluna errada `severidade`
- **Arquivo**: `supabase/functions/cs-playbook-runner/index.ts`, linha ~94
- **Problema**: Busca `.in('severidade', ['ALTA', 'CRITICA'])` na tabela `cs_incidents`, mas a coluna real chama-se `gravidade`.
- **Impacto**: Nenhum incidente critico e detectado pelo Phase 1 do playbook runner. O trigger `INCIDENT_CRITICAL` nunca dispara automaticamente.
- **Correcao**: Trocar `severidade` por `gravidade`.

### BUG 3 - MEDIO: `weekly-report` filtra deals por `empresa` inexistente
- **Arquivo**: `supabase/functions/weekly-report/index.ts`, linhas 31, 38, 47, 57
- **Problema**: Todas as queries usam `.eq('empresa', empresa)` na tabela `deals`, mas `deals` NAO tem coluna `empresa`. Deals herdam empresa via `contacts.empresa` pelo `contact_id`.
- **Impacto**: Todas as queries retornam 0 resultados. O relatorio semanal gera dados vazios e a narrativa IA e baseada em zeros.
- **Correcao**: Usar join com contacts para filtrar por empresa, ex: `.select('*, contacts!inner(empresa)').eq('contacts.empresa', empresa)`.

### BUG 4 - BAIXO: `notifications` sem coluna `metadata`
- **Arquivos**: `sgt-webhook` (linha 2138), `bluechat-inbound` (linha 1083), `deal-scoring` (linha 289)
- **Problema**: Inserem campo `metadata` na tabela `notifications`, mas essa coluna nao existe. Os campos disponiveis sao: `id, user_id, empresa, tipo, titulo, mensagem, link, lida, entity_id, entity_type, created_at`.
- **Impacto**: Dados de metadados (deal_id, temperatura, lead_id) sao silenciosamente descartados. Notificacoes funcionam mas sem contexto adicional.
- **Correcao**: Adicionar coluna `metadata JSONB DEFAULT '{}'` na tabela `notifications`, ou usar `entity_id`/`entity_type` para referenciar o deal.

### BUG 5 - BAIXO: `notifications` sem `user_id` em insercoes SGT/BlueChat
- **Arquivos**: `sgt-webhook` (linha 2132), `bluechat-inbound` (linha 1077)
- **Problema**: Notificacoes de "Lead QUENTE" sao inseridas sem `user_id`. A tabela `notifications` tem `user_id` mas nao tem default. Se o banco aceitar NULL, a notificacao fica orfam (nao aparece pra ninguem).
- **Impacto**: Notificacoes de leads quentes nunca aparecem para nenhum vendedor.
- **Correcao**: Buscar vendedores (closers/admins) da empresa e criar notificacao para cada um, similar ao que `cs-playbook-runner` faz para ADMINs.

### BUG 6 - BAIXO: `weekly-report` busca ADMINs por `profiles.role`
- **Arquivo**: `supabase/functions/weekly-report/index.ts`, linha 184
- **Problema**: Busca `.eq('role', 'ADMIN')` e `.eq('empresa', empresa)` na tabela `profiles`, mas `profiles` nao tem colunas `role` nem `empresa`. Roles estao em `user_roles` e empresa em `empresa_id`.
- **Impacto**: Nenhum admin e notificado sobre o relatorio semanal.
- **Correcao**: Fazer join com `user_roles` para encontrar admins.

---

## SECAO 2: O QUE ESTA BEM FEITO

### Arquitetura
- Isolamento multi-tenant `BLUE`/`TOKENIZA` consistente em todo o sistema
- CompanyProvider com migracao automatica de valores legados
- Sistema de acesso granular com fallback para roles legados
- Lazy loading de todas as paginas com error boundaries isolados
- Hierarquia de IA de 4 camadas (Gemini > Claude > GPT-4o > Deterministico) em todas as funcoes

### Roteamento Inteligente + Dedup (recen-implementado)
- IDs de stage hardcoded conferidos — todos corretos no banco
- `resolveTargetPipeline` cobre BLUE (1 pipeline, 3 temperaturas) e TOKENIZA (2 pipelines por tipo_lead, 3 temperaturas cada)
- `findExistingDealForPerson` implementa 4 criterios em hierarquia correta (CPF > tel_e164 > variacoes > email)
- Variacoes de telefone cobrem com/sem 9o digito e com/sem DDI
- Placeholder emails corretamente excluidos da busca

### SDR IA (Amelia)
- Motor de qualificacao consultiva com SPIN/GPCT/BANT
- Deteccao de urgencia com 5 tipos de sinais
- Anti-limbo: nunca deixa conversa sem resposta (fallback progressivo)
- Auto-takeover: detecta modo MANUAL e silencia automacao
- Resolucao automatica de tickets no Blue Chat

### Pipeline & CRM
- Deal scoring com 6 dimensoes e sugestao IA de proxima acao
- Sistema de SLA por stage com alertas
- Campos customizados EAV para Contatos, Orgs e Deals
- Automacao de regras por pipeline (triggers de stage)

### CS Module
- Health calculator, churn predictor, NPS auto
- Playbook runner com auto-deteccao de triggers
- Incident detector por sentimento
- Bridge CS-Renovacao (auto-criacao de deal de renovacao)

### Infra de Mensageria
- Roteamento por canal (Blue Chat vs Mensageria)
- Opt-out enforced antes de qualquer envio
- Modo teste configuravel por banco (sem hardcode)
- Cadence runner com horario comercial e placeholders inteligentes

---

## SECAO 3: FUNCIONALIDADES DESCONECTADAS

### 1. Pipeline de Renovacao ausente
- O `cs-playbook-runner` tem step `CRIAR_DEAL_RENOVACAO` que busca pipeline com `tipo: 'RENOVACAO'`
- Porem, NENHUM pipeline no banco tem `tipo = 'RENOVACAO'`. Todos estao como `COMERCIAL`.
- **Impacto**: O step `CRIAR_DEAL_RENOVACAO` nunca cria deal. A pagina `/renovacao` provavelmente mostra vazio tambem.
- **Correcao**: Criar um pipeline de renovacao ou atualizar o `tipo` de um existente para `'RENOVACAO'`.

### 2. Sidebar tem items sem registro no screenRegistry
- Sidebar tem `funis_config` e `campos_config` como screenKeys, mas `screenRegistry.ts` nao os registra
- `organizacoes` esta na sidebar mas nao no screenRegistry
- `cs_playbooks` esta no screenRegistry mas na sidebar usa `BookOpen` icon (OK, apenas observacao)
- **Impacto**: Controle de acesso granular nao funciona para esses 3 items — sempre visiveis.

### 3. Rota `/` nao protegida
- A rota `<Route path="/" element={<Index />} />` NAO usa `ProtectedRoute`
- O `Index.tsx` faz redirect manual, mas existe janela de tempo onde `isLoading=true` e mostra spinner sem protecao
- **Impacto**: Minimo — apenas UX, nao e brecha de seguranca (redireciona para auth se nao autenticado).

---

## SECAO 4: DICAS DE EVOLUCAO

### 1. Centralizar funcoes utilitarias entre edge functions
- `resolveTargetPipeline`, `findExistingDealForPerson`, `generatePhoneVariationsForSearch` estao duplicados em `sgt-webhook` e `bluechat-inbound`
- Qualquer correcao precisa ser feita em 2 lugares
- **Sugestao**: Embora edge functions nao compartilhem codigo facilmente, documente que alteracoes devem ser replicadas

### 2. CRON jobs nao configurados
- `cadence-runner`, `cs-playbook-runner`, `deal-scoring`, `cs-incident-detector`, `weekly-report`, `revenue-forecast`, `cs-renewal-alerts` sao todos desenhados para CRON
- O `config.toml` nao tem configuracao de cron (nao e suportado nativamente pelo Lovable Cloud)
- **Sugestao**: Documentar como disparar via CRON externo (ex: pg_cron, GitHub Actions, ou chamada HTTP periodica)

### 3. Adicionar coluna `empresa` na tabela `deals` (desnormalizacao)
- Muitas queries precisam fazer join com `contacts` para filtrar por empresa
- Adicionar `empresa TEXT` em `deals` simplificaria queries e eliminaria bugs como o do `weekly-report`

### 4. Implementar health check para Google/OpenAI
- `integration-health-check` redireciona `gemini` e `gpt` para `checkAnthropic` em vez de verificar os servicos reais
- **Sugestao**: Criar health checks especificos para Gemini e OpenAI

### 5. Adicionar testes end-to-end para webhooks
- Os webhooks (`sgt-webhook`, `bluechat-inbound`) sao complexos (2200+ e 1500+ linhas)
- Sem testes automatizados alem dos unitarios basicos existentes
- **Sugestao**: Criar testes via `supabase--test-edge-functions` com payloads reais

### 6. Playbooks CS sem rota de configuracao
- A sidebar tem "Playbooks" em CS, mas a pagina serve apenas para visualizacao
- Nao ha interface para criar novos tipos de step ou configurar triggers
- **Sugestao**: Expandir `CSPlaybooksPage` com formulario de criacao

### 7. Deal-scoring notifica com empresa hardcoded
- `deal-scoring` linha 288: insere notificacao com `empresa: 'BLUE'` hardcoded
- **Sugestao**: Usar empresa do deal (via join com contacts) ou do pipeline

### 8. Zadarma sem secret configurado
- Nenhum `ZADARMA_API_KEY` nos secrets
- A edge function `zadarma-proxy` provavelmente usa variaveis de ambiente para autenticacao
- Verificar se telefonia esta operacional

---

## SECAO 5: RESUMO DE PRIORIDADES

| Prioridade | Item | Tipo |
|---|---|---|
| CRITICA | BUG 1: next-best-action tabela inexistente | Bug |
| CRITICA | BUG 3: weekly-report empresa inexistente | Bug |
| ALTA | BUG 2: cs-playbook-runner severidade vs gravidade | Bug |
| ALTA | BUG 5: notifications sem user_id (leads quentes orfaos) | Bug |
| ALTA | Pipeline RENOVACAO ausente | Desconectado |
| MEDIA | BUG 4: metadata em notifications | Dados perdidos |
| MEDIA | BUG 6: weekly-report busca admin errada | Bug |
| MEDIA | Screen registry incompleto | Desconectado |
| BAIXA | Deal-scoring empresa hardcoded | Melhoria |
| BAIXA | Health check Gemini/OpenAI | Melhoria |

---

## SECAO TECNICA: ARQUIVOS A CORRIGIR

1. `supabase/functions/next-best-action/index.ts` — Linha 57: trocar `cadence_runs` por `deal_cadence_runs`
2. `supabase/functions/cs-playbook-runner/index.ts` — Linha ~94: trocar `severidade` por `gravidade`
3. `supabase/functions/weekly-report/index.ts` — Linhas 31, 38, 47: remover `.eq('empresa')` de deals e usar join com contacts; Linha 184: corrigir busca de admins
4. `supabase/functions/sgt-webhook/index.ts` — Linhas 2132-2139: adicionar `user_id` nas notificacoes
5. `supabase/functions/bluechat-inbound/index.ts` — Linhas 1077-1084: adicionar `user_id` nas notificacoes
6. `supabase/functions/deal-scoring/index.ts` — Linha 288: dinamizar empresa
7. `src/config/screenRegistry.ts` — Adicionar `funis_config`, `campos_config`, `organizacoes`
8. Migracao SQL: adicionar coluna `metadata JSONB` em `notifications`
9. Migracao SQL: criar pipeline tipo `RENOVACAO` ou atualizar tipo existente
