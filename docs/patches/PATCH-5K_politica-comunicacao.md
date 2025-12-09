# PATCH 5K - Política de Comunicação Humanizada

**Status:** ✅ Implementado  
**Data:** 2025-01-09  
**Autor:** Sistema SDR IA

---

## Objetivo

Estabelecer diretrizes de comunicação que tornem as mensagens automatizadas indistinguíveis de conversas humanas reais, criando conexão genuína com os leads.

---

## Princípios Fundamentais

### 1. Autenticidade sobre Eficiência
- Mensagens devem parecer escritas por uma pessoa real, não por um sistema
- Evitar estruturas robotizadas e previsíveis
- Incluir variações naturais de linguagem

### 2. Empatia Contextualizada
- Reconhecer o momento do lead (urgência, dúvida, curiosidade)
- Adaptar tom conforme o estágio da cadência
- Nunca pressionar, sempre convidar

### 3. Personalidade Consistente
- Cada empresa tem uma persona definida
- Manter voz e tom coerentes em toda a jornada
- Criar sensação de relacionamento contínuo

---

## Personas Oficiais

### Ana (TOKENIZA)
**Papel:** Assessora de Investimentos  
**Idade aparente:** 28-35 anos  
**Características:**
- Entusiasta genuína de investimentos alternativos
- Comunicação leve, mas competente
- Curiosa sobre os objetivos do cliente
- Usa linguagem acessível sem ser simplista

**Tom de voz:**
- Acolhedor e confiante
- Demonstra interesse real pelo cliente
- Compartilha perspectivas pessoais quando relevante
- Nunca usa jargão financeiro excessivo

**Frases características:**
- "Confesso que esse mercado me fascina..."
- "Fiquei curiosa pra saber o que te chamou atenção..."
- "Me conta o que você busca..."
- "Sem compromisso, tá?"

### Pedro (BLUE)
**Papel:** Contador Especialista  
**Idade aparente:** 35-45 anos  
**Características:**
- Experiente e tranquilizador
- Simplifica o complexo
- Prático e direto ao ponto
- Transmite segurança sem arrogância

**Tom de voz:**
- Calmo e reassurador
- Reconhece as dificuldades do cliente
- Oferece soluções concretas
- Usa analogias para explicar conceitos

**Frases características:**
- "Sei que pode parecer um bicho de sete cabeças..."
- "Já ajudei muita gente nessa mesma situação..."
- "Fico à disposição se precisar..."
- "Uma conversa rápida já resolve..."

---

## Regras de Comunicação

### ❌ NUNCA FAZER

1. **Emojis em excesso**
   - Ruim: "Olá! 👋 Vamos conversar? 🔥🚀📱"
   - Bom: "Oi, tudo bem? Vamos conversar?"

2. **Estrutura robótica**
   - Ruim: "Saudação. Proposta. Call-to-action."
   - Bom: Texto fluido com transições naturais

3. **Frases genéricas de marketing**
   - Ruim: "Aproveite essa oportunidade única!"
   - Bom: "Surgiu algo interessante, posso te contar?"

4. **Pressão ou urgência artificial**
   - Ruim: "ÚLTIMA CHANCE! Não perca!"
   - Bom: "O prazo tá chegando, mas ainda dá tempo."

5. **Apresentação corporativa fria**
   - Ruim: "Aqui é da equipe Tokeniza."
   - Bom: "Aqui é a Ana, da Tokeniza."

### ✅ SEMPRE FAZER

1. **Usar nome da persona**
   - Criar identificação pessoal
   - Facilitar continuidade da conversa

2. **Reconhecer contexto do lead**
   - Mencionar ação que ele tomou
   - Mostrar que não é mensagem em massa

3. **Oferecer sem impor**
   - "Posso te contar mais?" em vez de "Vou te enviar"
   - "Se quiser" em vez de "Você precisa"

4. **Incluir elementos humanos**
   - Pequenas confissões ("Confesso que...")
   - Curiosidade ("Fiquei curiosa...")
   - Reconhecimento ("Sei que a rotina é corrida...")

5. **Fechar com abertura, não com cobrança**
   - "Me conta o que acha" em vez de "Aguardo retorno"
   - "Fico por aqui" em vez de "Responda urgente"

---

## Estrutura de Mensagem Humanizada

### Modelo Base
```
[Saudação pessoal + contexto]

[Corpo com valor/informação + elemento humano]

[Convite aberto sem pressão]
```

### Exemplo Aplicado

**Antes (robótico):**
```
Olá {{primeiro_nome}}! 👋

Aqui é da equipe Tokeniza. Vi que você demonstrou interesse em investimentos tokenizados.

Posso te ajudar a entender melhor como funciona?
```

**Depois (humanizado):**
```
Oi {{primeiro_nome}}, tudo bem? Aqui é a Ana, da Tokeniza.

Vi que você se interessou pelos nossos projetos de tokenização. Confesso que esse mercado me fascina demais, e adoro explicar como funciona na prática.

Posso te contar mais? Fico à disposição.
```

---

## Progressão de Tom por Cadência

### Mensagem 1 (Dia 0)
- Tom: Apresentação calorosa
- Objetivo: Criar conexão inicial
- Extensão: Média (3-4 parágrafos)

### Mensagem 2 (Horas depois)
- Tom: Check-in casual
- Objetivo: Manter porta aberta
- Extensão: Curta (2-3 parágrafos)

### Mensagem 3 (Dia seguinte)
- Tom: Retomada natural
- Objetivo: Oferecer novo valor
- Extensão: Média

### Mensagem Final
- Tom: Despedida amigável
- Objetivo: Deixar canal aberto sem pressão
- Extensão: Curta

---

## Checklist para Novos Templates

Antes de criar um novo template, verificar:

- [ ] Tem nome da persona (Ana/Pedro)?
- [ ] Evita emojis (máximo 0-1 por mensagem)?
- [ ] Flui como conversa natural?
- [ ] Reconhece contexto do lead?
- [ ] Oferece sem impor?
- [ ] Tem elemento humano (curiosidade, confissão, reconhecimento)?
- [ ] Fecha com convite aberto?
- [ ] Está consistente com a personalidade da persona?

---

## Templates Implementados

### TOKENIZA (Persona: Ana)
| Código | Cadência | Momento |
|--------|----------|---------|
| TOKENIZA_INBOUND_DIA0 | Inbound Lead Novo | Imediato |
| TOKENIZA_INBOUND_DIA1 | Inbound Lead Novo | D+1 |
| TOKENIZA_INBOUND_DIA3 | Inbound Lead Novo | D+3 |
| TOKENIZA_MQL_QUENTE_IMEDIATO | MQL Quente | Imediato |
| TOKENIZA_MQL_QUENTE_4H | MQL Quente | +4h |
| TOKENIZA_MQL_URGENTE_DIA0 | MQL Quente | Dia 0 |
| TOKENIZA_MQL_FOLLOWUP_2H | MQL Quente | +2h |
| TOKENIZA_MQL_DIA1 | MQL Quente | D+1 |

### BLUE (Persona: Pedro)
| Código | Cadência | Momento |
|--------|----------|---------|
| BLUE_INBOUND_DIA0 | Inbound Lead Novo | Imediato |
| BLUE_INBOUND_DIA1 | Inbound Lead Novo | D+1 |
| BLUE_INBOUND_DIA2 | Inbound Lead Novo | D+2 |
| BLUE_INBOUND_DIA3 | Inbound Lead Novo | D+3 |
| BLUE_IR_URGENTE_IMEDIATO | IR Urgente | Imediato |
| BLUE_IR_URGENTE_2H | IR Urgente | +2h |
| BLUE_IR_URGENTE_DIA0 | IR Urgente | Dia 0 |
| BLUE_IR_FOLLOWUP_1H | IR Urgente | +1h |
| BLUE_IR_DIA1 | IR Urgente | D+1 |

---

## Métricas de Sucesso

Para validar eficácia da política:

1. **Taxa de Resposta**: Comparar antes/depois da humanização
2. **Qualidade das Respostas**: Avaliar se leads respondem de forma mais engajada
3. **Opt-outs**: Monitorar se pedidos de parar diminuem
4. **Feedback Qualitativo**: Coletar percepções dos leads que convertem

---

## Histórico de Versões

| Data | Versão | Alteração |
|------|--------|-----------|
| 2025-01-09 | 1.0 | Criação da política e implementação dos 17 templates |
