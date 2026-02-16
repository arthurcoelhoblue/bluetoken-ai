
# Roadmap V7 → 11/10 — Blocos por Prioridade

## BLOCO 1 — Quick Wins (1 semana)

### 1.1 Versionar 16 CRON jobs ✅
- Documentação criada em `docs/patches/PATCH-CRON-VERSIONING.md`
- 16 jobs mapeados com SQL idempotente pronto para execução
- Jobs já ativos em produção, documento garante reprodutibilidade

### 1.2 Reduzir `as any` restantes ✅
- Reduzido de 51 para 12 ocorrências (76% de redução)
- 12 restantes são necessários (tabelas não presentes no schema gerado)
- 314/314 testes passando

---

## BLOCO 2 — Observabilidade Avançada (2 semanas)

### 2.1 Dashboard de saúde operacional melhorado
- Tela única: Web Vitals, Sentry, status CRONs, latência edge functions
- Status: PENDENTE

### 2.2 Sentry para Edge Functions (Deno)
- Capturar erros em edge functions no Sentry
- Status: PENDENTE

---

## BLOCO 3 — Automação Inteligente (3 semanas)

### 3.1 Atividade auto-criada após transcrição de chamada
- Status: PENDENTE

---

## BLOCO 4 — Arquitetura de Longo Prazo (1-3 meses)

### 4.1 Multi-tenancy com schema separation
- Status: PENDENTE

### 4.2 Revenue forecast com ML
- Status: PENDENTE
