# PATCH 5G — SDR IA Engine (Interpretação de Mensagens)

**Status:** ✅ Concluído  
**Data:** 2025-12-09  

---

## Objetivo

Criar o cérebro do SDR IA para interpretar mensagens inbound e aplicar ações automáticas.

---

## Entregas

### A) Tabela `lead_message_intents`
- Armazena interpretações de IA
- Campos: intent, confidence, summary, ação recomendada/aplicada
- Enums: `lead_intent_tipo`, `sdr_acao_tipo`

### B) Edge Function `sdr-ia-interpret`
- Recebe `messageId`
- Carrega contexto (mensagem, histórico, lead, cadência)
- Chama Lovable AI Gateway (gemini-2.5-flash)
- Salva interpretação
- Aplica ações: pausar/cancelar cadência, criar tarefa closer, opt-out

### C) Tipos TypeScript
- `src/types/intent.ts`: LeadIntentTipo, SdrAcaoTipo, labels, helpers

### D) UI
- `IntentHistoryCard`: card reutilizável para exibir interpretações
- Integrado em `LeadDetail`

### E) Integração
- `whatsapp-inbound` agora dispara `sdr-ia-interpret` automaticamente

---

## Arquivos Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/*_patch5g.sql` | Migration tabela + enums |
| `supabase/functions/sdr-ia-interpret/index.ts` | Edge function IA |
| `supabase/functions/whatsapp-inbound/index.ts` | Integração com SDR IA |
| `src/types/intent.ts` | Tipos TypeScript |
| `src/hooks/useLeadIntents.ts` | Hook React Query |
| `src/components/intents/IntentHistoryCard.tsx` | Componente UI |
| `src/pages/LeadDetail.tsx` | Integração do card |
| `supabase/config.toml` | Nova função |

---

## Intenções Detectáveis

| Intent | Descrição |
|--------|-----------|
| INTERESSE_COMPRA | Lead quer comprar/investir |
| DUVIDA_PRODUTO | Pergunta sobre produto |
| DUVIDA_PRECO | Pergunta sobre preço |
| AGENDAMENTO_REUNIAO | Quer marcar reunião |
| OPT_OUT | Pede descadastro |
| RECLAMACAO | Insatisfação |
| ... | Ver `src/types/intent.ts` |

---

## Ações Automáticas

| Ação | Efeito |
|------|--------|
| PAUSAR_CADENCIA | Pausa run ativa |
| CANCELAR_CADENCIA | Cancela run |
| MARCAR_OPT_OUT | Cancela + marca opt-out |
| CRIAR_TAREFA_CLOSER | Cria evento para closer + pausa |
| ESCALAR_HUMANO | Registra evento de escalação |

---

## Como Testar

```bash
# Simular mensagem inbound
curl -X POST https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/whatsapp-inbound \
  -H "X-API-Key: $WHATSAPP_INBOUND_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+5561998317422",
    "message_id": "test-123",
    "timestamp": "2025-12-09T10:00:00Z",
    "text": "Quero saber mais sobre os investimentos"
  }'
```

---

## Logs Esperados

```
[Inbound] Webhook recebido
[Lead] Match encontrado
[Inbound] Mensagem salva
[SDR-IA] Iniciando interpretação
[IA] Resposta recebida
[Ação] Cadência pausada
[SDR-IA] Interpretação salva
```
