

# Copilot Proativo Autonomo + Rastreamento de Atividade do Usuario

## Problema atual

O `generateInsights()` so e chamado quando o usuario abre o painel manualmente. O Copilot nao "observa" o que o usuario faz na tela.

## Solucao em 2 partes

### Parte 1: Auto-geracao de insights (frontend)

**Arquivo: `src/components/copilot/CopilotFab.tsx`**

Adicionar um `useEffect` que:
1. Chama `generateInsights()` ao montar o componente (primeira vez que o FAB aparece)
2. Configura um `setInterval` de 30 minutos para repetir a chamada automaticamente
3. O cache de 30 min no hook + backend garante que chamadas duplicadas sao ignoradas sem custo

```
useEffect(() => {
  generateInsights();
  const interval = setInterval(() => generateInsights(), 30 * 60 * 1000);
  return () => clearInterval(interval);
}, [generateInsights]);
```

### Parte 2: Rastreamento de acoes do usuario para contexto

Criar um hook `useUserActivityTracker` que registra acoes significativas do usuario em uma tabela leve e envia esse contexto para a edge function.

**Nova tabela: `user_activity_log`**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| user_id | uuid | Referencia ao usuario |
| empresa | text | |
| action_type | text | Tipo: PAGE_VIEW, DEAL_UPDATED, NOTE_ADDED, LEAD_VIEWED, PIPELINE_FILTERED |
| action_detail | jsonb | Metadados (ex: deal_id, titulo, rota) |
| created_at | timestamptz | |

RLS: usuarios so veem suas proprias acoes.

**Novo hook: `src/hooks/useUserActivityTracker.ts`**

- Registra `PAGE_VIEW` automaticamente a cada mudanca de rota (via `useLocation`)
- Exporta funcao `trackAction(type, detail)` para componentes registrarem acoes explicitas (ex: mover deal no pipeline, adicionar nota)
- Faz debounce para evitar spam (maximo 1 registro por rota a cada 30s)
- Mantem apenas as ultimas 48h de atividade (limpeza via trigger ou TTL)

**Arquivo: `src/components/copilot/CopilotFab.tsx`**

- Importar e ativar o `useUserActivityTracker` dentro do FAB (que ja esta montado globalmente)

**Arquivo: `supabase/functions/copilot-proactive/index.ts`**

- Adicionar query para buscar as ultimas 20 entradas de `user_activity_log` do usuario
- Incluir no `contextParts` enviado a IA como "Navegacao Recente do Usuario"
- Atualizar o prompt para incluir instrucao: "Observe o que o usuario tem feito nos ultimos minutos e adapte seus insights ao contexto de uso atual"

### Parte 3: Integracao com acoes existentes

Adicionar chamadas `trackAction()` nos pontos-chave ja existentes:

| Local | Acao rastreada |
|-------|----------------|
| `useDealDetail.ts` (addActivity) | `DEAL_ACTIVITY_ADDED` com deal_id e tipo |
| Pipeline drag-and-drop | `DEAL_MOVED` com deal_id, stage anterior e novo |
| Pagina de lead | `LEAD_VIEWED` com lead_id |
| `PipelineConfigPage` | `CONFIG_CHANGED` com pipeline_id |

Isso sera feito de forma incremental — inicialmente apenas `PAGE_VIEW` automatico, depois acoes explicitas.

## Fluxo completo

```text
Usuario navega/age no app
        |
        v
useUserActivityTracker registra em user_activity_log
        |
        v (a cada 30 min via setInterval)
CopilotFab chama generateInsights()
        |
        v
copilot-proactive le: deals + SLA + tarefas + metas + ATIVIDADE DO USUARIO
        |
        v
IA gera insights contextualizados ao que o usuario esta fazendo
        |
        v
Bolha de notificacao aparece no FAB
```

## Arquivos alterados/criados

| Arquivo | Acao |
|---------|------|
| `src/hooks/useUserActivityTracker.ts` | **Novo** — rastreia navegacao e acoes |
| `src/components/copilot/CopilotFab.tsx` | Adicionar auto-generate + activity tracker |
| `supabase/functions/copilot-proactive/index.ts` | Incluir activity_log no contexto da IA |
| Migracao SQL | Criar tabela `user_activity_log` com RLS |

## Seguranca

- RLS restrita: `user_id = auth.uid()`
- Dados de atividade sao efemeros (ultimas 48h)
- Nenhum dado sensivel e armazenado — apenas tipo de acao e IDs de referencia
- Rate limit do backend (30 min) impede abuso de chamadas a IA
