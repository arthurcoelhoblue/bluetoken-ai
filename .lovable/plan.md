

# Roadmap V7 → 11/10 — Blocos por Prioridade

## BLOCO 1 — Quick Wins (1 semana)
Itens de baixo esforco e alto impacto na nota de auditoria.

### 1.1 Versionar 16 CRON jobs em migration SQL
- Criar uma migration contendo `SELECT cron.schedule(...)` para cada um dos 16 jobs ativos
- Garante reprodutibilidade em staging e disaster recovery
- Prioridade do parecer: MEDIA
- Esforco: 1 dia

### 1.2 Reduzir `as any` restantes (51 ocorrencias)
- Mapear os 51 `as any` e substituir por tipagens corretas
- Maioria em integrações com tipos do banco de dados
- Prioridade do parecer: BAIXA (mas facil de resolver)
- Esforco: 2-3 dias

---

## BLOCO 2 — Observabilidade Avancada (2 semanas)

### 2.1 Dashboard de saude operacional melhorado
- Tela unica mostrando: Web Vitals (LCP/CLS/INP), erros do Sentry, status dos 16 CRONs, latencia das edge functions (via `ai_usage_log`)
- Consolida dados que ja existem mas estao espalhados
- Esforco: 1-2 semanas

### 2.2 Sentry para Edge Functions (Deno)
- Capturar erros de edge functions no Sentry com stack traces
- Complementa o logger estruturado que ja existe em 55 pontos
- Prioridade do parecer: BAIXA (logger ja ajuda muito)
- Esforco: 1 semana

---

## BLOCO 3 — Automacao Inteligente (3 semanas)

### 3.1 Atividade auto-criada apos transcricao de chamada
- `call-transcribe` finaliza → cria automaticamente um registro em `deal_activities` com resumo IA
- Zero esforco do vendedor para registrar chamadas
- Esforco: 3-5 dias

---

## BLOCO 4 — Arquitetura de Longo Prazo (1-3 meses)

### 4.1 Multi-tenancy com schema separation
- Separar dados BLUE e TOKENIZA em schemas distintos
- Elimina risco residual de RLS bypass entre empresas
- Esforco: 1 mes

### 4.2 Revenue forecast com ML
- Treinar modelo de regressao com dados historicos de deals
- Substituir heuristicas atuais por predicao real
- Esforco: 3 meses

---

## Resumo Visual

```text
BLOCO 1 (Semana 1)        BLOCO 2 (Semanas 2-3)      BLOCO 3 (Semana 4)       BLOCO 4 (Meses 2-4)
+--------------------+     +---------------------+     +-------------------+     +-------------------+
| CRON em migration  |     | Dashboard saude ops |     | Auto-atividade    |     | Multi-tenancy     |
| Remover as any     |     | Sentry Edge Fn      |     | pos-transcricao   |     | ML Forecast       |
+--------------------+     +---------------------+     +-------------------+     +-------------------+
```

## Sugestao de Execucao

Recomendo comecar pelo **Bloco 1** inteiro (CRON + as any) por ser de execucao rapida e impacto direto na nota de auditoria. Apos concluido, seguir para o Bloco 2 que consolida a observabilidade.
