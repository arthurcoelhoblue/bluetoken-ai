

# Escalação Inteligente para Humano — ✅ IMPLEMENTADO

## O que foi feito

### 1. Migration: `closer_notifications` com prioridade
- Adicionadas colunas `prioridade` (TEXT, default 'MEDIA'), `intent` (TEXT), `temperatura` (TEXT)

### 2. `action-executor.ts` — ESCALAR_HUMANO unificado
- Busca classificação do lead (temperatura) e intent dos detalhes
- Calcula prioridade: CRITICA, ALTA, MEDIA, BAIXA
- Busca owner do contato → round-robin se sem owner
- Chama `notify-closer` com prioridade/intent/temperatura
- Insere notificação in-app diferenciada (🔴🟠🟡⚪) na tabela `notifications`
- Cria deal automaticamente se lead QUENTE e sem deal aberto

### 3. `notify-closer/index.ts` — Email diferenciado
- Aceita campos `prioridade`, `intent`, `temperatura`, `notify_user_id`
- Persiste prioridade/intent/temperatura no `closer_notifications`
- Assunto e título do email diferenciados por prioridade

### 4. `sdr-ia-interpret/index.ts` — Contexto enriquecido
- Passa `intent` do classificador nos `acao_detalhes` para que o action-executor tenha acesso

## Prioridades

| Prioridade | Condição | Notificação |
|---|---|---|
| CRITICA | QUENTE + INTERESSE_COMPRA/AGENDAMENTO_REUNIAO | 🔴 Lead quente quer fechar |
| ALTA | QUENTE ou INTERESSE_COMPRA isolado | 🟠 Lead qualificado pede atendimento |
| MEDIA | MORNO ou pedido explícito | 🟡 Lead pede contato humano |
| BAIXA | FRIO ou anti-limbo | ⚪ Conversa escalada |
