# PATCH 6G – SDR IA Qualificador Consultivo

## Objetivo

Transformar o SDR IA em um qualificador consultivo usando metodologias de vendas (Receita Previsível + SPIN/GPCT+BANT), garantindo que reuniões só sejam sugeridas quando o lead estiver verdadeiramente qualificado.

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

## Regras de CTA

A IA SÓ pode sugerir reunião se:

1. **Temperatura** ≥ MORNO
2. **Intent** indica interesse (INTERESSE_COMPRA, INTERESSE_IR, SOLICITACAO_CONTATO, AGENDAMENTO_REUNIAO)
3. **Framework preenchido**:
   - BLUE: pelo menos S, P e I do SPIN
   - TOKENIZA: pelo menos G e C do GPCT + B do BANT

Se a IA tentar sugerir reunião sem atender critérios:
- Ação é convertida de CRIAR_TAREFA_CLOSER para ENVIAR_RESPOSTA_AUTOMATICA
- Log registra tentativa bloqueada

## Arquivos Modificados

- `supabase/functions/sdr-ia-interpret/index.ts`
  - Novos tipos: `ProximaPerguntaTipo`, `ConversationQualiState`
  - Novas funções: `decidirProximaPerguntaBLUE()`, `decidirProximaPerguntaTOKENIZA()`, `decidirProximaPergunta()`, `validarCTAReuniao()`
  - SYSTEM_PROMPT atualizado com foco em qualificação consultiva
  - `interpretWithAI()` calcula e passa instrução de próxima pergunta

## Exemplo de Fluxo

### Cenário: Lead novo na TOKENIZA

1. **Mensagem 1**: "Oi, vi sobre investimentos tokenizados"
   - Estado: SAUDACAO
   - Próxima pergunta: GPCT_G
   - Resposta: "Oi! Que bom que você se interessou! Me conta, qual seu principal objetivo com investimentos hoje? Renda extra, aposentadoria, diversificar...?"

2. **Mensagem 2**: "Quero diversificar minha carteira"
   - Estado: DIAGNOSTICO, GPCT.g = "diversificação"
   - Próxima pergunta: GPCT_C
   - Resposta: "Diversificar é uma ótima estratégia! E o que mais te atrapalha hoje para conseguir diversificar do jeito que gostaria?"

3. **Mensagem 3**: "Banco oferece só fundos com taxa alta"
   - Estado: QUALIFICACAO, GPCT.c = "taxas altas de banco"
   - Próxima pergunta: GPCT_P
   - Resposta: "Entendo! E hoje você investe mais em produtos tradicionais do banco ou já explora outras alternativas?"

4. **Mensagem 4**: "Só banco mesmo, mas tenho bitcoin"
   - Estado: QUALIFICACAO, GPCT.p = "banco + bitcoin"
   - Próxima pergunta: GPCT_T
   - Resposta: "Legal que já tem cripto! Em quanto tempo você imagina construir essa carteira mais diversificada? Curto, médio ou longo prazo?"

5. **Mensagem 5**: "Médio prazo, uns 2-3 anos"
   - Estado: QUALIFICACAO, GPCT completo
   - Próxima pergunta: BANT_B
   - Resposta: "Perfeito! E pra gente entender melhor as opções que fazem sentido, você tem uma ideia de quanto gostaria de alocar? Abaixo de 10k, entre 10k e 50k, ou acima?"

... (continua até qualificação completa)

## Testes

1. ✅ Lead novo recebe pergunta GPCT_G (Tokeniza) ou SPIN_S (Blue)
2. ✅ Perguntas seguem sequência do framework
3. ✅ CTA só aparece após qualificação mínima
4. ✅ IA bloqueada de sugerir reunião prematura
5. ✅ Estado de framework é persistido entre mensagens
6. ✅ Tom adapta ao perfil DISC detectado

## Próximos Passos

- [ ] PATCH 6H: Perguntas pré-configuradas por tipo (banco de perguntas)
- [ ] PATCH 6I: Dashboard de qualificação (visualizar pipeline por etapa SPIN/GPCT)
- [ ] PATCH 6J: A/B testing de prompts de qualificação
