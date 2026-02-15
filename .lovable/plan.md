

# Fase 3, Tarefa 19 -- Testes E2E para Fluxos Criticos

## Objetivo
Implementar testes unitarios e de integracao cobrindo os fluxos criticos identificados no roadmap do PO, garantindo auditabilidade e confianca nas entregas das Fases 1-3.

## Escopo dos Testes

Os testes seguem o padrao ja existente no projeto (Vitest + Testing Library), focando em **logica pura** e **transformacoes de dados** -- os fluxos que o PO precisa auditar.

### 1. AI Cost Dashboard (`useAICostDashboard.test.ts`)
- Agregacao por function/provider/model
- Calculo de tendencia diaria
- Taxa de erro e latencia media
- Tratamento de dados vazios

### 2. Adoption Metrics (`useAdoptionMetrics.test.ts`)
- Contagem de usuarios unicos por feature
- Ordenacao por total de eventos
- Dados vazios retornam array vazio

### 3. Follow-up Hours (`useFollowUpHours.test.ts`)
- `getBestSendTime()` com dados validos
- Retorno de fallback sem dados
- Formatacao correta de dia/hora

### 4. Prompt Versioning (`usePromptVersions.test.ts`)
- Logica de versionamento incremental
- Desativacao da versao anterior
- Interface `PromptVersion` correta

### 5. Lead Classification (`useLeadClassification.test.ts`)
- Mapeamento de tipos (ICP, Temperatura, Prioridade)
- Filtros compostos (empresa + classificacao)
- Paginacao correta

### 6. Analytics Events (`useAnalyticsEvents.test.ts`)
- Gerador de sessionId unico
- Batching (queue + flush com timer)
- Formatacao de eventos (page_view, feature)

### 7. Screen Registry Expandido (`screenRegistry.test.ts`)
- Nova rota `/admin/ai-costs` esta registrada
- Todas as rotas da Fase 3 existem no registry

## Detalhes Tecnicos

### Padrao dos testes
Todos seguem o padrao ja existente no projeto:
- Testes de **logica pura** extraida dos hooks (sem mock de Supabase)
- Validacao de **tipos e interfaces** via TypeScript
- Verificacao de **transformacoes de dados** (agregacao, map/reduce, formatacao)
- Localizados em `src/hooks/__tests__/` ou ao lado do arquivo original

### Arquivos a criar
| Arquivo | Cobertura |
|---------|-----------|
| `src/hooks/__tests__/useAICostDashboard.test.ts` | Agregacao, KPIs, trend |
| `src/hooks/__tests__/useAdoptionMetrics.test.ts` | Unique users, sorting |
| `src/hooks/__tests__/useFollowUpHours.test.ts` | getBestSendTime logic |
| `src/hooks/__tests__/usePromptVersions.test.ts` | Version interface |
| `src/hooks/__tests__/useLeadClassification.test.ts` | Type mapping, filters |
| `src/hooks/__tests__/useAnalyticsEvents.test.ts` | Session, batching |
| `src/config/__tests__/screenRegistry.test.ts` | Atualizar com rotas Fase 3 |

### Arquivos a editar
| Arquivo | Mudanca |
|---------|---------|
| `.lovable/plan.md` | Marcar Task 19 como concluida |

### Nenhuma dependencia nova necessaria
O projeto ja possui `vitest`, `@testing-library/react`, `@testing-library/jest-dom` e `jsdom`.

## Criterio de Aceite do PO
- Todos os testes passam (`vitest run`)
- Cobertura dos 7 modulos criticos das Fases 1-3
- Zero dependencias novas adicionadas
- Padroes consistentes com testes existentes

