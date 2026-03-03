

## Avaliação Completa dos 3 PRs Pendentes

Analisei cada PR linha por linha contra o schema real do banco (types.ts). Encontrei problemas críticos em todos os três.

---

### PR #3: "4 patches pipeline — Atividades obrigatórias, Produtos, Ganhar/Perder, Telefone"

**O que faz:** 4 features — (1) dialog de "agendar próximo passo" ao fechar deal sheet, (2) aba de Produtos no deal, (3) remoção de Win/Lose do DealCard, (4) formatação de telefone BR.

#### Problemas Encontrados

| # | Severidade | Problema |
|---|-----------|----------|
| 1 | CRITICO | `deal_activities` insert usa `{ deal_id, tipo, descricao, tarefa_prazo }` — **funciona**, mas `ScheduleActivityDialog` importa de `@/types/dealDetail` que já é o re-export correto. OK. |
| 2 | CRITICO | `useDealProducts` usa `from('deal_products' as 'deals')` — hack de tipo. As tabelas `deal_products` e `catalog_products` são criadas pela migration mas **NÃO existem no types.ts atual**. O cast `as 'deals'` engana o TypeScript mas funciona em runtime **somente se a migration rodar primeiro**. |
| 3 | ALTO | A migration `20260303190000_deal_products.sql` tem **RLS policies totalmente abertas** (`USING (true)`, `WITH CHECK (true)`) em ambas as tabelas. Qualquer usuário autenticado pode ler/inserir/deletar produtos de qualquer empresa. Violação de isolamento multi-tenant. |
| 4 | MEDIO | `DealProductsTab` recebe `empresa` como prop mas no PR #4 muda para `pipelineEmpresa`. **Conflito de merge** entre os dois PRs — o PR #4 assume que PR #3 já foi mergeado com uma interface diferente. |
| 5 | MEDIO | Remoção dos botões Win/Lose do `DealCard` — a funcionalidade de ganhar/perder deal agora só existe no `DealDetailSheet` via `DealLossDialog`. Isso é intencional (simplificação), mas remove a ação rápida do kanban. |
| 6 | BAIXO | `formatPhoneBR` no input do `ZadarmaPhoneWidget` faz `value={formatPhoneBR(number) || number}` — formata enquanto digita, mas `onChange` strip não-dígitos. Pode causar cursor jump no input. |

#### Veredito PR #3
**Pode ser mergeado COM correções:**
- Corrigir RLS das tabelas `catalog_products` e `deal_products` para filtrar por empresa
- Resolver conflito de prop `empresa` vs `pipelineEmpresa` com PR #4

---

### PR #4: "Sistema de Agendamento Google Calendar + Reuniões"

**O que faz:** Sistema completo de agendamento — Google Calendar OAuth, booking de reuniões, processamento de transcrições, aba de Reuniões no deal, integração com SDR-IA para agendamento conversacional.

#### Problemas Encontrados

| # | Severidade | Problema |
|---|-----------|----------|
| 1 | CRITICO | `calendar-book` insere em `meetings` com colunas **inexistentes**: `vendedor_id` (real: `owner_id`), `data_hora_inicio`/`data_hora_fim` (real: `data_inicio`/`data_fim`), `fuso_horario` (não existe), `convidado_nome/email/telefone` (não existem), `agendado_por` (não existe), `lead_id` (não existe). **Vai falhar em runtime.** |
| 2 | CRITICO | `calendar-book` insere em `deal_activities` com colunas **inexistentes**: `titulo`, `data_agendada`, `status`, `criado_por`. O schema real tem apenas: `deal_id`, `tipo`, `descricao`, `metadata`, `tarefa_prazo`, `tarefa_concluida`, `user_id`. **Vai falhar.** |
| 3 | CRITICO | `meeting-transcription` insere em `deal_activities` com mesmas colunas inexistentes (`titulo`, `status`, `criado_por`). **Vai falhar.** |
| 4 | CRITICO | `meeting-transcription` insere em `lead_facts` como tabela separada — mas `lead_facts` no schema é uma **coluna JSONB** dentro de `lead_conversation_state`, não uma tabela. **Vai falhar.** |
| 5 | CRITICO | `useMeetings.ts` (frontend) busca `meetings` com colunas que não existem: `vendedor_id`, `lead_id`, `convidado_nome/email/telefone`, `data_hora_inicio/fim`, `fuso_horario`, `agendado_por`. **Vai retornar dados vazios/errados.** |
| 6 | CRITICO | `meeting_scheduling_state` — o PR insere com `slots_propostos`, `tentativa_numero`, `expires_at`, `vendedor_id`, mas o schema real tem `slots_oferecidos`, sem `tentativa_numero`, sem `expires_at`, `owner_id` em vez de `vendedor_id`. **Colunas incompatíveis.** |
| 7 | CRITICO | `getLeadVendedorId` no `sdr-ia-interpret` busca `deals.responsavel_id` e `deals.empresa` — **nenhuma dessas colunas existe** na tabela deals. Deals não tem `empresa` direto (é via pipeline), e usa `owner_id` não `responsavel_id`. Fallback busca `profiles.empresa` e `profiles.ativo` — ambas inexistentes. |
| 8 | CRITICO | `useCalendarConfig.ts` do PR cria um hook **novo** que conflita com o que já existe na main. A main já tem `src/hooks/useCalendarConfig.ts` (que acabamos de corrigir). O PR sobrescreve com uma versão diferente que usa `as any` novamente e colunas diferentes. |
| 9 | CRITICO | `CalendarConfigPanel.tsx` do PR é um arquivo **novo** que conflita com o existente na main. A main já tem este componente. O PR vai sobrescrever a versão corrigida. |
| 10 | ALTO | Edge functions usam CORS hardcoded em vez do módulo `_shared/cors.ts` do projeto. |
| 11 | ALTO | Nenhuma edge function usa `assertEmpresa` para validação de tenant. |
| 12 | ALTO | `google-calendar-auth` usa `GOOGLE_CALENDAR_CLIENT_ID` mas `calendar-book` usa `GOOGLE_CLIENT_ID` — nomes de secret inconsistentes. |

#### Veredito PR #4
**NÃO deve ser mergeado.** Tem ~12 erros críticos de incompatibilidade com o schema. Praticamente todas as queries de meetings e scheduling vão falhar em runtime. O mapeamento de colunas está completamente errado.

---

### Commit 33bd280: "sync-renewal-triggers" (branch feature/9-melhorias-backlog)

**(Já analisado na mensagem anterior, resumo atualizado)**

| # | Severidade | Problema |
|---|-----------|----------|
| 1 | CRITICO | `deals` não tem coluna `empresa` |
| 2 | CRITICO | `vendedor_id`/`valor_estimado` não existem em `deals` |
| 3 | CRITICO | `contact_id` obrigatório ausente no insert |
| 4 | CRITICO | `posicao_kanban` obrigatório ausente |
| 5 | CRITICO | 7 colunas inexistentes em `cs_customers` |
| 6 | CRITICO | `empresa` obrigatório ausente em `notifications` |
| 7 | ALTO | Sem `assertEmpresa` |
| 8 | MEDIO | Sem logger estruturado |

#### Veredito sync-renewal-triggers
**NÃO deve ser mergeado.** Mesmo problema que PR #4 — colunas inventadas que não existem no schema.

---

### Resumo Geral

| PR | Status | Erros Críticos | Pode Mergear? |
|----|--------|---------------|--------------|
| #3 (Pipeline patches) | Quase pronto | 1 (RLS aberto) | Sim, com correção de RLS |
| #4 (Google Calendar) | Quebrado | 12+ | Não — precisa reescrita |
| sync-renewal-triggers | Quebrado | 8+ | Não — precisa reescrita |

### Plano de Ação Recomendado

1. **PR #3** — Corrigir RLS policies de `catalog_products` e `deal_products` para filtrar por empresa, resolver conflito de prop com PR #4, e mergear.

2. **PR #4** — Precisa reescrita completa do mapeamento de colunas:
   - `meetings`: usar `owner_id`, `data_inicio`/`data_fim`, `titulo`, `contact_id` (colunas reais)
   - `deal_activities`: usar apenas `deal_id`, `tipo`, `descricao`, `metadata`, `user_id`
   - `meeting_scheduling_state`: usar `owner_id`, `slots_oferecidos`, `slot_escolhido`
   - `lead_facts` é coluna JSONB, não tabela — mudar abordagem
   - Padronizar nomes de secrets do Google
   - Usar `_shared/cors.ts` e `assertEmpresa`

3. **sync-renewal-triggers** — Reescrever para usar colunas reais de `deals`, `cs_customers`, `notifications`. Adicionar `assertEmpresa` e logger.

Posso implementar as correções de todos os três aqui no Lovable se você quiser mergear as branches pra main.

