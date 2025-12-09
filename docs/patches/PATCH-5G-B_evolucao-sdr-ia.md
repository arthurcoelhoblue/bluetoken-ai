# PATCH 5G-B — Evolução do Motor SDR IA

**Status:** 📋 Planejado  
**Data:** 2025-12-09  
**Dependências:** PATCH 5G (SDR IA Engine), PATCH 5K (Política de Comunicação)

---

## Objetivo

Evoluir o motor SDR IA existente para:
1. **Responder automaticamente** quando fizer sentido
2. **Detectar novas intenções** específicas do negócio
3. **Garantir compliance** (sem promessas de retorno, sem indicar ativos)
4. **Ajustar temperatura** de forma inteligente

---

## Estado Atual vs. Proposto

| Funcionalidade | 5G Atual | 5G-B Proposto |
|----------------|----------|---------------|
| Interpreta inbound | ✅ | ✅ |
| Pausa/Cancela cadência | ✅ | ✅ |
| Cria tarefa closer | ✅ | ✅ |
| Marca opt-out | ✅ | ✅ |
| Escala humano | ✅ | ✅ |
| **Responde automaticamente** | ❌ | ✅ |
| **Ajusta temperatura** | ⚠️ Parcial | ✅ Completo |
| **Intents específicos IR/Preço** | ❌ | ✅ |
| **Regras de compliance** | ❌ | ✅ |

---

## Entregas

### A) Novos Enums de Intenção

Adicionar ao enum `lead_intent_tipo`:

| Intent | Descrição | Uso |
|--------|-----------|-----|
| `INTERESSE_IR` | Interesse específico em serviço de IR | BLUE |
| `OBJECAO_PRECO` | Acha caro/não compensa | Ambos |
| `OBJECAO_RISCO` | Medo de risco/perda | TOKENIZA |
| `SEM_INTERESSE` | Não quer, mas sem opt-out | Ambos |
| `DUVIDA_TECNICA` | Pergunta técnica sobre produto | Ambos |

### B) Nova Ação: ENVIAR_RESPOSTA_AUTOMATICA

Adicionar ao enum `sdr_acao_tipo`:

```sql
ALTER TYPE sdr_acao_tipo ADD VALUE 'ENVIAR_RESPOSTA_AUTOMATICA';
```

### C) Coluna de Resposta Automática

```sql
ALTER TABLE lead_message_intents 
ADD COLUMN resposta_automatica_texto TEXT NULL,
ADD COLUMN resposta_enviada_em TIMESTAMPTZ NULL;
```

### D) Prompt de IA Evoluído

O prompt deve incluir:

1. **Contexto da empresa**
   - TOKENIZA: investimentos tokenizados, público diverso
   - BLUE: serviços contábeis/IR, público PF/PJ

2. **Novas intenções** com exemplos

3. **Regras de compliance** (crítico):
   ```
   NUNCA:
   - Prometer retorno financeiro
   - Indicar ativo específico
   - Inventar prazos ou rentabilidade
   - Dar conselho de investimento
   - Negociar preços/descontos
   
   SEMPRE:
   - Convidar para conversa com especialista
   - Explicar conceitos gerais
   - Ser empático e respeitoso
   - Manter tom humanizado (Ana/Pedro)
   ```

4. **Formato de resposta automática**:
   - 1-3 frases
   - Tom da persona (Ana ou Pedro)
   - Sem emoji excessivo
   - Convite para próximo passo seguro

### E) Lógica de Resposta Automática

Quando `ENVIAR_RESPOSTA_AUTOMATICA` estiver nas ações:

```typescript
if (acoes.includes('ENVIAR_RESPOSTA_AUTOMATICA') && respostaTexto) {
  // 1. Salvar mensagem outbound
  const { data: msgSalva } = await supabase
    .from('lead_messages')
    .insert({
      lead_id: leadId,
      run_id: runId,
      empresa,
      canal: 'WHATSAPP',
      direcao: 'OUTBOUND',
      conteudo: respostaTexto,
      estado: 'PENDENTE',
      template_codigo: 'SDR_IA_AUTO'
    })
    .select()
    .single();

  // 2. Chamar whatsapp-send
  await fetch(WHATSAPP_SEND_URL, {
    method: 'POST',
    body: JSON.stringify({
      messageId: msgSalva.id,
      phone: leadPhone,
      message: respostaTexto
    })
  });

  // 3. Atualizar intent com timestamp
  await supabase
    .from('lead_message_intents')
    .update({ resposta_enviada_em: new Date().toISOString() })
    .eq('id', intentId);
}
```

### F) Ajustar Temperatura Completo

Implementar lógica real:

| Intent | Ação na Temperatura |
|--------|---------------------|
| INTERESSE_COMPRA/INTERESSE_IR | FRIO→MORNO, MORNO→QUENTE |
| AGENDAMENTO_REUNIAO | →QUENTE |
| OPT_OUT/SEM_INTERESSE | →FRIO |
| RECLAMACAO | Manter (não punir) |
| DUVIDA_* | Manter ou +1 nível |

### G) Evolução da UI

1. **IntentHistoryCard**: Mostrar resposta automática enviada
2. **Badge de status**: "Resposta enviada ✓"
3. **Timeline**: Visualizar inbound → interpretação → resposta

---

## Matriz de Decisão: Quando Responder?

| Intent | Confiança | Responder? | Exemplo de Resposta |
|--------|-----------|------------|---------------------|
| INTERESSE_COMPRA | >0.8 | ✅ | "Que bom! Posso te explicar..." |
| INTERESSE_IR | >0.8 | ✅ | "Entendi! Nosso serviço..." |
| AGENDAMENTO_REUNIAO | >0.7 | ✅ | "Perfeito! Vou organizar..." |
| DUVIDA_PRODUTO | >0.7 | ✅ | "Boa pergunta! Deixa eu..." |
| DUVIDA_PRECO | >0.7 | ✅ | "Entendo sua dúvida..." |
| OBJECAO_PRECO | >0.7 | ⚠️ | Criar tarefa, não responder |
| OBJECAO_RISCO | >0.7 | ⚠️ | Criar tarefa, não responder |
| OPT_OUT | >0.6 | ❌ | Apenas cancelar |
| NAO_ENTENDI | * | ❌ | Não arriscar |
| OUTRO | <0.5 | ❌ | Escalar humano |

---

## Exemplos de Respostas Automáticas

### TOKENIZA (Ana)

**INTERESSE_COMPRA:**
> "Que legal que você se interessou! Posso te explicar como funciona o processo de investimento ou, se preferir, já te ajudo a falar com um dos nossos especialistas. O que fica melhor pra você?"

**DUVIDA_PRODUTO:**
> "Boa pergunta! Esse é um ponto importante mesmo. Deixa eu te explicar de forma simples: [explicação genérica]. Quer que eu detalhe mais ou prefere conversar com alguém da equipe?"

**AGENDAMENTO_REUNIAO:**
> "Perfeito! Vou organizar isso pra você. Qual horário fica bom essa semana? Manhã ou tarde?"

### BLUE (Pedro)

**INTERESSE_IR:**
> "Entendi, você quer regularizar a situação do IR. É mais comum do que parece! Posso te explicar como funciona nosso processo ou já agendar uma conversa pra entender melhor seu caso. O que prefere?"

**DUVIDA_PRECO:**
> "Entendo sua dúvida sobre o investimento. Cada caso é único, mas nosso foco é sempre encontrar a melhor solução dentro do seu orçamento. Quer que eu passe seu contato pra um dos nossos contadores explicar as opções?"

---

## Fluxo Completo Pós-5G-B

```
Lead responde no WhatsApp
        ↓
whatsapp-inbound salva mensagem
        ↓
sdr-ia-interpret é chamado
        ↓
┌─────────────────────────────────────┐
│ IA analisa com contexto completo:   │
│ - Histórico de mensagens            │
│ - Classificação do lead             │
│ - Cadência ativa                    │
│ - Política de comunicação           │
│ - Regras de compliance              │
└─────────────────────────────────────┘
        ↓
Retorna:
- intent + confidence
- ações recomendadas
- resposta sugerida (se aplicável)
        ↓
aplicarAcoes():
├── PAUSAR_CADENCIA → update status
├── CANCELAR_CADENCIA → update status  
├── CRIAR_TAREFA_CLOSER → insert task
├── MARCAR_OPT_OUT → update lead
├── AJUSTAR_TEMPERATURA → update classification
└── ENVIAR_RESPOSTA_AUTOMATICA → whatsapp-send
        ↓
Lead recebe resposta humanizada
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/*_patch5gb.sql` | Migration: novos enums + coluna |
| `supabase/functions/sdr-ia-interpret/index.ts` | Evoluir prompt + lógica resposta |
| `src/types/intent.ts` | Novos tipos + labels |
| `src/components/intents/IntentHistoryCard.tsx` | Mostrar resposta automática |
| `docs/patches/PATCH-5G-B_evolucao-sdr-ia.md` | Este documento |

---

## Plano de Execução

### Fase 1: Database (Migration)
- [ ] Adicionar novos valores aos enums
- [ ] Adicionar colunas resposta_automatica_texto e resposta_enviada_em

### Fase 2: Backend (Edge Function)
- [ ] Evoluir prompt com compliance e novas intenções
- [ ] Implementar lógica de resposta automática
- [ ] Implementar AJUSTAR_TEMPERATURA completo
- [ ] Adicionar logging detalhado

### Fase 3: Tipos TypeScript
- [ ] Atualizar src/types/intent.ts
- [ ] Adicionar novos labels e helpers

### Fase 4: UI
- [ ] Evoluir IntentHistoryCard
- [ ] Adicionar indicador de resposta enviada

### Fase 5: Testes
- [ ] Testar cenário INTERESSE_COMPRA
- [ ] Testar cenário OPT_OUT
- [ ] Testar cenário OBJECAO_PRECO
- [ ] Validar compliance (sem promessas)

---

## Critérios de Sucesso

1. ✅ Lead recebe resposta automática em <5s quando aplicável
2. ✅ Respostas seguem política de comunicação (Ana/Pedro)
3. ✅ Zero promessas de retorno financeiro
4. ✅ Cadências pausadas/canceladas corretamente
5. ✅ Temperatura ajustada conforme matriz
6. ✅ UI mostra histórico completo de interpretações

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| IA responde algo inadequado | Prompt rígido + confidence threshold alto |
| Resposta duplicada | Verificar se já respondeu antes de enviar |
| Latência alta | Cache de contexto, modelo rápido (flash) |
| Opt-out não respeitado | Verificar opt_out antes de qualquer envio |

---

## Aprovação

- [ ] Plano revisado
- [ ] Migration aprovada
- [ ] Implementação iniciada
