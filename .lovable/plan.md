

# Diagnóstico: GPCT, DISC e Base de Conhecimento no Arthur Coelho

## O que JÁ está funcionando (dados reais do banco)

O backend está fazendo o trabalho. Os dados do Arthur Coelho mostram:

- **GPCT preenchido**: G=Expandir portfólio, P=R$ 100k, C=Indefinição venture vs ativos reais, T=Não explicitado
- **BANT preenchido**: B=R$ 100k, A=Arthur (decisor), N=Clareza regulatória, T=Não explicitado
- **SPIN preenchido**: S=Busca tokenização, P=R$ 100k em equity, I=Risco regulatório Portugal, N=Entender modelo
- **DISC detectado**: C (Conforme) — correto, o Arthur faz perguntas técnicas analíticas
- **lead_facts**: patrimônio R$ 100k, experiência venture, interesse em Portugal e ativos tangíveis
- **RAG chamado**: knowledge-search é invocado a cada mensagem

## Problemas reais encontrados

### 1. Estado do funil travou em SAUDACAO
O `estado_funil` ficou em SAUDACAO durante quase toda a conversa (7+ mensagens), pulando direto para FECHAMENTO via rule-based. Deveria ter progredido: SAUDACAO → DIAGNOSTICO → QUALIFICACAO → FECHAMENTO.

**Causa**: O `novo_estado_funil` retornado pelo classifier nem sempre é gravado. Quando a IA retorna um estado, o action-executor deve atualizar, mas em vários turnos o estado não avançou.

### 2. Resposta "geralmente entre R$ 5 e R$ 10 mil" — já corrigida
Essa resposta foi gerada às 23:40 ANTES do deploy da regra de ouro. O fix já está ativo e futuras respostas não devem repetir esse padrão.

### 3. Respostas começando com nome do lead
"Arthur." e "Arthur!" aparecem no início de respostas, violando a regra "PROIBIDO: começar com nome do lead". O sanitizer deveria capturar isso mas o padrão "Arthur." (ponto final) não está coberto.

### 4. Tom DISC C poderia ser mais forte
O DISC C está detectado e injetado no prompt, mas as respostas ainda soam genéricas em alguns turnos. O tom deveria ser mais técnico e direto, com dados concretos — especialmente para o perfil C.

## Correções propostas

### A. Corrigir progressão do estado do funil no intent-classifier
Garantir que o classifier retorne `novo_estado_funil` consistentemente baseado no contexto:
- Se está em SAUDACAO e lead demonstrou interesse → DIAGNOSTICO
- Se GPCT tem ≥2 campos → QUALIFICACAO  
- Se lead faz objeção → OBJECOES
- Se lead quer investir → FECHAMENTO

Adicionar lógica pós-classificação no `intent-classifier.ts` que calcula o estado correto baseado nos frameworks preenchidos, em vez de depender exclusivamente da IA retornar o campo.

### B. Reforçar sanitização do nome do lead
No `response-generator.ts`, o regex de sanitização precisa cobrir "Nome." (com ponto) além de "Nome," e "Nome!".

### C. Reforçar instrução DISC no prompt do classifier
Adicionar ao `SYSTEM_PROMPT` uma instrução mais forte: quando DISC é C, a `resposta_sugerida` DEVE conter dados numéricos, prazos concretos e referências regulatórias. Sem frases vagas.

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/sdr-ia-interpret/intent-classifier.ts` | Adicionar cálculo automático de `novo_estado_funil` pós-classificação + reforçar instrução DISC na resposta |
| `supabase/functions/sdr-ia-interpret/response-generator.ts` | Corrigir sanitização de nome com ponto |

