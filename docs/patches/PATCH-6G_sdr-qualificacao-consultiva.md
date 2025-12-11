# PATCH 6G – SDR IA Qualificador Consultivo + Precificação Blue

**Status:** ✅ Concluído  
**Data:** 2025-12-11  

---

## Objetivo

Transformar o SDR IA em um qualificador consultivo usando metodologias de vendas (Receita Previsível + SPIN/GPCT+BANT), garantindo que reuniões só sejam sugeridas quando o lead estiver verdadeiramente qualificado. **Inclui conhecimento de precificação Blue para responder dúvidas de valor.**

---

## Escopo

### ✅ Implementado

1. **Lógica de Decisão de Próxima Pergunta**
   - Função `decidirProximaPerguntaBLUE()` - implementa SPIN
   - Função `decidirProximaPerguntaTOKENIZA()` - implementa GPCT + BANT
   - Função `decidirProximaPergunta()` - orquestra decisão por empresa
   - Função `validarCTAReuniao()` - impede CTAs prematuros

2. **Novo SYSTEM_PROMPT Qualificador**
   - Foco em qualificação, não em agendamento
   - Instruções claras sobre frameworks SPIN e GPCT+BANT
   - Regras explícitas de quando sugerir reunião
   - Adaptação ao perfil DISC

3. **Integração no Fluxo**
   - Cálculo de próxima pergunta antes de chamar IA
   - Instrução de pergunta passa no contexto do prompt
   - Validação pós-IA para bloquear CTAs prematuros
   - Registro da pergunta feita no estado da conversa

4. **Gap Fixes (2025-12-11)**
   - ✅ Contexto de última pergunta (`ultima_pergunta_id`) adicionado ao prompt
   - ✅ Bloqueio efetivo de CTA prematuro (remove resposta se contém reunião/agendar)
   - ✅ Instrução ativa de tom DISC (`getDiscToneInstruction()`)
   - ✅ Listagem de dados já coletados para evitar repetição
   - ✅ Função `perguntaJaRespondida()` para validação

5. **Tabela de Preços Blue (2025-12-11)**
   - ✅ Constante `BLUE_PRICING` com todos os planos e valores
   - ✅ Função `formatBluePricingForPrompt()` para montar contexto
   - ✅ Regras de quando mencionar preços (DUVIDA_PRECO, SPIN_N, pergunta direta)
   - ✅ Regras de compliance (não divulgar Customizado, não negociar)

---

## Lógica de Decisão

### BLUE (SPIN)

```
SAUDAÇÃO → SPIN_S (Situação)
         ↓
SPIN_S preenchido? → SPIN_P (Problema)
         ↓
SPIN_P preenchido? → SPIN_I (Implicação)
         ↓
SPIN_I preenchido? → SPIN_N (Need-Payoff)
         ↓
SPIN completo + interesse + temperatura ≥ MORNO? → CTA_REUNIAO
```

### TOKENIZA (GPCT + BANT)

```
SAUDAÇÃO → GPCT_G (Goals)
         ↓
GPCT_G preenchido? → GPCT_C (Challenges)
         ↓
GPCT_C preenchido? → GPCT_P (Plans)
         ↓
GPCT_P preenchido? → GPCT_T (Timeline)
         ↓
GPCT completo? → BANT_B (Budget)
         ↓
BANT_B preenchido? → BANT_A (Authority)
         ↓
BANT_A preenchido? → BANT_N (Need)
         ↓
BANT_N preenchido? → BANT_T (Timing)
         ↓
GPCT+BANT completo + interesse + temperatura ≥ MORNO? → CTA_REUNIAO
```

---

## Tipos de Pergunta

| Tipo | Framework | Descrição |
|------|-----------|-----------|
| SPIN_S | SPIN | Situação atual (como declara IR, software usado) |
| SPIN_P | SPIN | Problemas/dores (dificuldades, medos) |
| SPIN_I | SPIN | Implicações (riscos de não resolver) |
| SPIN_N | SPIN | Need-Payoff (valor da solução) |
| GPCT_G | GPCT | Goals (objetivos com investimento) |
| GPCT_P | GPCT | Plans (como investe hoje) |
| GPCT_C | GPCT | Challenges (o que atrapalha) |
| GPCT_T | GPCT | Timeline (horizonte de tempo) |
| BANT_B | BANT | Budget (faixa de investimento) |
| BANT_A | BANT | Authority (quem decide) |
| BANT_N | BANT | Need (força da necessidade) |
| BANT_T | BANT | Timing (quando quer resolver) |
| CTA_REUNIAO | - | Lead qualificado, sugerir reunião |
| NENHUMA | - | Continuar conversa naturalmente |

---

## Regras de CTA

A IA SÓ pode sugerir reunião se:

1. **Temperatura** ≥ MORNO
2. **Intent** indica interesse (INTERESSE_COMPRA, INTERESSE_IR, SOLICITACAO_CONTATO, AGENDAMENTO_REUNIAO)
3. **Framework preenchido**:
   - BLUE: pelo menos S, P e I do SPIN
   - TOKENIZA: pelo menos G e C do GPCT + B do BANT

Se a IA tentar sugerir reunião sem atender critérios:
- Ação é convertida de `CRIAR_TAREFA_CLOSER` para `ENVIAR_RESPOSTA_AUTOMATICA`
- Resposta é **removida** se contiver menção a "reunião", "agendar", "conversar com", "especialista"
- Log registra tentativa bloqueada

---

## Gap Fixes Implementados

### 1. Contexto de Última Pergunta
```typescript
if (conversationState.ultima_pergunta_id) {
  userPrompt += `⚠️ ÚLTIMA PERGUNTA FEITA: ${conversationState.ultima_pergunta_id}\n`;
  userPrompt += `NÃO repita esta pergunta. Avance para a próxima etapa.\n`;
}
```

### 2. Bloqueio Efetivo de CTA Prematuro
```typescript
if (!validarCTAReuniao(aiSugeriuReuniao, qualiState)) {
  if (parsed.resposta_sugerida?.toLowerCase().includes('reunião')) {
    parsed.resposta_sugerida = null;
    parsed.deve_responder = false;
  }
}
```

### 3. Instrução Ativa de Tom DISC
```typescript
function getDiscToneInstruction(disc: PerfilDISC): string {
  const instrucoes = {
    'D': '🎯 ADAPTE SEU TOM: Seja DIRETO e objetivo.',
    'I': '🎯 ADAPTE SEU TOM: Seja LEVE e conversado.',
    'S': '🎯 ADAPTE SEU TOM: Seja CALMO e acolhedor.',
    'C': '🎯 ADAPTE SEU TOM: Seja ESTRUTURADO e lógico.',
  };
  return instrucoes[disc];
}
```

### 4. Listagem de Dados Já Coletados
```
## DADOS JÁ COLETADOS (NÃO PERGUNTE NOVAMENTE):
✅ GPCT_G (Goals): Diversificar carteira
✅ GPCT_C (Challenges): Taxas altas de banco
```

---

## Tabela de Preços Blue (IR Cripto)

### Planos Principais
| Plano | Preço | Descrição |
|-------|-------|-----------|
| IR Cripto - Gold | R$ 4.497 | Carteiras/exchanges ilimitadas, até 25k transações/ano |
| IR Cripto - Diamond | R$ 2.997 | Até 4 carteiras/exchanges, até 25k transações/ano |
| IR Cripto - Customizado* | R$ 998 | Até 4 carteiras/exchanges, até 2k transações/ano |

*\* Plano Customizado é uso INTERNO, não divulgar ao lead*

### Serviços Adicionais
| Serviço | Preço |
|---------|-------|
| +5.000 operações | R$ 500 |
| Apuração de dependente | R$ 500/dependente |
| Upgrade Diamond → Gold | R$ 1.500 |
| IR Simples (sem cripto) | R$ 300 |

### Formas de Pagamento
- PIX à vista, criptomoedas, ou cartão até 12x sem juros
- Desconto PIX/Cripto: até **15%**
- Desconto Cartão: até **10%**

### Quando o SDR Pode Mencionar Preços
✅ Quando o lead pergunta "quanto custa?"  
✅ Durante SPIN_N (Need-Payoff), vinculando valor ao benefício  
✅ Quando intent = `DUVIDA_PRECO`  
✅ Quando intent = `OBJECAO_PRECO` (explicar o valor agregado)

### Regras de Compliance
❌ NÃO negociar preços além dos descontos padrão  
❌ NÃO divulgar plano Customizado  
❌ NÃO prometer valores diferentes dos tabelados

---

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/sdr-ia-interpret/index.ts` | Gap fixes + lógica consultiva |
| `src/types/conversation.ts` | Tipos TypeScript |
| `src/hooks/useConversationState.ts` | Hook React Query |
| `src/components/conversation/ConversationStateCard.tsx` | UI |

---

## Exemplo de Fluxo

### Cenário: Lead novo na TOKENIZA

1. **Mensagem 1**: "Oi, vi sobre investimentos tokenizados"
   - Estado: SAUDACAO
   - Próxima pergunta: GPCT_G
   - Resposta: "Oi! Que bom que você se interessou! Me conta, qual seu principal objetivo com investimentos hoje?"

2. **Mensagem 2**: "Quero diversificar minha carteira"
   - Estado: DIAGNOSTICO, GPCT.g = "diversificação"
   - Próxima pergunta: GPCT_C
   - ⚠️ ultima_pergunta_id = "GPCT_G" (não repetir!)
   - Resposta: "Diversificar é ótimo! E o que mais te atrapalha hoje para conseguir isso?"

3. **Mensagem 3**: "Banco oferece só fundos com taxa alta"
   - Estado: QUALIFICACAO, GPCT.c = "taxas altas"
   - Próxima pergunta: GPCT_P
   - DISC detectado: C (cauteloso - pergunta técnica)
   - 🎯 Tom: estruturado e lógico

... (continua até qualificação completa)

---

## Testes

1. ✅ Lead novo recebe pergunta GPCT_G (Tokeniza) ou SPIN_S (Blue)
2. ✅ Perguntas seguem sequência do framework
3. ✅ CTA só aparece após qualificação mínima
4. ✅ IA bloqueada de sugerir reunião prematura (resposta removida)
5. ✅ Estado de framework é persistido entre mensagens
6. ✅ Tom adapta ao perfil DISC detectado
7. ✅ Última pergunta é mostrada no prompt para evitar repetição
8. ✅ Dados já coletados são listados explicitamente

---

## Próximos Passos

- [ ] PATCH 6H: Perguntas pré-configuradas por tipo (banco de perguntas)
- [ ] PATCH 6I: Dashboard de qualificação (visualizar pipeline por etapa SPIN/GPCT)
- [ ] PATCH 6J: A/B testing de prompts de qualificação
