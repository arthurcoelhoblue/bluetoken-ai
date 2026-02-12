
# Avaliacao da Amelia - Problemas e Melhorias

## Analise das Conversas Reais (ultimos 7 dias)

Analisei todas as conversas recentes da Amelia com leads reais. Aqui estao os problemas identificados e as melhorias propostas.

---

## PROBLEMAS CRITICOS DE COMUNICACAO

### 1. "Perfeito!" ainda escapa do filtro de sanitizacao
Apesar do filtro extenso, a palavra **"Perfeito!"** aparece em praticamente TODAS as respostas da Amelia como inicio de frase. Exemplos reais:
- "Perfeito! Com 20-40 operacoes..."
- "Perfeito! Pode buscar essas informacoes..."
- "Perfeito! Renda extra e o foco..."
- "Perfeito! Primeiro estruturar..."
- "Perfeito! Vou encaminhar..."
- "Perfeito! Projeto bem estruturado..."

**Causa raiz:** O sanitizador so remove "Perfeito, [Nome]!" mas NAO remove "Perfeito!" sozinho no inicio. A IA continua usando "Perfeito!" como muleta.

**Correcao:** Adicionar regex para remover "Perfeito!", "Entendi!", "Otimo!" isolados no inicio da resposta E adicionar instrucao explicita no prompt proibindo essas muletas.

### 2. Bloco de 3 perguntas disparado em contexto ERRADO
Quando o lead do Blue Chat chega via handoff da MarIA, a Amelia frequentemente dispara o bloco de 3 perguntas de qualificacao mesmo quando o contexto nao pede isso:

- Lead "Cliente" pede material de live → Amelia responde com bloco de 3 perguntas sobre IR
- Lead "Deus Seja Louvado" pede plano Gold → Amelia responde com bloco de 3 perguntas
- Lead "Alessandro" quer falar com Gabriel (renovacao) → Amelia responde com bloco de 3 perguntas

**Causa raiz:** O bloco e ativado sempre que `estadoFunil === 'SAUDACAO'` e `historicoLength <= 3`, sem analisar o contexto real da conversa (triagem). Ele ignora o que o lead REALMENTE quer.

**Correcao:** Antes de ativar o bloco, analisar o conteudo do handoff. Se o lead esta pedindo algo especifico (material, renovacao, falar com pessoa especifica), NAO disparar o bloco.

### 3. Amelia promete coisas que nao pode cumprir
No caso do Fernando (Tokeniza), a Amelia:
- Prometeu "encaminhar para rede de parceiros de Venture Capital, Family Offices" - algo que a Tokeniza NAO FAZ
- Prometeu "retorno em 48h" da equipe de relacionamento
- Disse que tinha "rede de investidores que buscam oportunidades" para conectar

**Causa raiz:** A regra de "nao inventar informacoes" se aplica a dados tecnicos (garantias, prazos), mas a IA inventa PROCESSOS e SERVICOS que nao existem. O prompt nao proibe fabricar capacidades operacionais.

**Correcao:** Adicionar regra explicita: "NUNCA prometa servicos, encaminhamentos ou processos que voce nao tem certeza que existem. Se nao sabe se o servico existe, diga: 'vou verificar com a equipe se temos algo nessa linha.'"

### 4. Amelia nao sabe quando desqualificar um lead
O Fernando (Tokeniza) nao era investidor, nao tinha dinheiro, nao tinha empresa, e repetidamente disse "nao me encaixo na Tokeniza". Mesmo assim a Amelia:
- Continuou qualificando por dezenas de mensagens
- Tentou empurrar investimento de R$1-2k para quem esta com aluguel atrasado
- Recomecou a conversa MULTIPLAS vezes (reaberturas de ticket)
- Nunca sinalizou ao sistema que o lead era desqualificado

**Causa raiz:** Nao existe uma acao `DESQUALIFICAR_LEAD` ou `ENCERRAR_ATENDIMENTO`. A Amelia fica presa em loop de qualificacao.

**Correcao:** Criar nova acao `DESQUALIFICAR_LEAD` que marca o lead como frio e encerra o atendimento graciosamente. Adicionar instrucao no prompt para detectar leads claramente fora do perfil.

### 5. Mensagens duplicadas no Blue Chat
Varias conversas mostram a mesma resposta enviada 2x (mesma resposta com timestamps diferentes, segundos de diferenca).

**Causa raiz:** O webhook `bluechat-inbound` recebe o mesmo handoff 2x (timestamps mostram 4s de diferenca). Nao ha deduplicacao.

**Correcao:** Implementar deduplicacao por `conversation_id` + `message_id` ou hash do conteudo com janela de 30s.

### 6. Falta de "memoria de sessao" no Blue Chat
Quando um ticket e reaberto, a Amelia recebe todo o historico do ticket NOVAMENTE como `[NOVO ATENDIMENTO]` e trata como um atendimento novo. Resultado: repete apresentacao, repete perguntas ja respondidas.

**Causa raiz:** O `bluechat-inbound` nao verifica se ja existe conversa recente com aquele lead. Cada handoff cria um novo ciclo.

**Correcao:** Antes de processar um `[NOVO ATENDIMENTO]`, verificar se ja existe mensagem recente (ultimas 2h) do mesmo lead/empresa. Se sim, tratar como continuacao, nao novo atendimento.

---

## PROBLEMAS DE LOGICA/NEGOCIO

### 7. Amelia nao sabe lidar com clientes de RENOVACAO
O caso "Alessandro [Renovacao 2026]" mostra que o lead ja e cliente e quer renovar - ele quer falar com Gabriel, nao ser qualificado. A Amelia deveria:
- Detectar "[Renovacao]" no nome
- Saber que e um cliente existente
- Escalar direto para o atendente responsavel, sem qualificacao

**Correcao:** Adicionar deteccao de "Renovacao" no nome do lead e tratar como `ESCALAR_HUMANO` imediato com mensagem tipo "Vi que voce ja e nosso cliente! Vou te conectar com a equipe que cuida da sua conta."

### 8. Cross-selling Blue->Tokeniza em leads BLUE nao faz sentido neste contexto
Na conversa do Arthur (Tokeniza), quando ele perguntou sobre IR, a transicao funcionou bem. Mas na logica atual, leads que sao claramente da Blue e querem IR podem receber mencoes sobre investimentos sem contexto.

---

## PLANO DE IMPLEMENTACAO

### Fase 1: Sanitizacao de Resposta (prompt + filtro)
**Arquivo:** `supabase/functions/sdr-ia-interpret/index.ts`

1. Expandir `sanitizeRoboticResponse()` para remover "Perfeito!", "Entendi!", "Otimo!", "Excelente!" isolados no inicio
2. Adicionar ao SYSTEM_PROMPT e PASSIVE_CHAT_PROMPT:
   - Proibir "Perfeito!" como inicio de frase
   - Adicionar regra contra fabricar servicos/processos inexistentes
3. Adicionar variacao forcada: se a resposta comeca com palavra proibida, substituir por abertura aleatoria das `VARIACOES_TRANSICAO`

### Fase 2: Logica de Bloco Inteligente
**Arquivo:** `supabase/functions/sdr-ia-interpret/index.ts`

1. Na funcao `decidirProximaPerguntaBLUE()`, antes de ativar bloco:
   - Verificar se ha triageSummary e se o lead pediu algo especifico
   - Se o lead mencionou "material", "renovacao", "falar com [nome]" → NAO ativar bloco
   - Se o lead e renovacao → escalar direto

### Fase 3: Acao DESQUALIFICAR_LEAD
**Arquivo:** `supabase/functions/sdr-ia-interpret/index.ts`

1. Adicionar ao enum de acoes
2. Adicionar instrucao no prompt para identificar leads fora do perfil
3. Quando ativada: marcar temperatura FRIO, encerrar conversa com mensagem amigavel

### Fase 4: Deduplicacao de Mensagens Blue Chat
**Arquivo:** `supabase/functions/bluechat-inbound/index.ts`

1. Antes de salvar mensagem, verificar se ja existe mensagem com mesmo conteudo do mesmo lead nos ultimos 30s
2. Se duplicada, retornar 200 sem processar

### Fase 5: Deteccao de Continuacao de Conversa
**Arquivo:** `supabase/functions/bluechat-inbound/index.ts`

1. Verificar se existe interacao recente (< 2h) com o lead
2. Se sim, nao enviar como `[NOVO ATENDIMENTO]` - tratar como continuacao
3. Incluir flag `isReturningLead: true` no context para sdr-ia-interpret

### Fase 6: Deteccao de Cliente Renovacao
**Arquivo:** `supabase/functions/sdr-ia-interpret/index.ts`

1. Se nome do lead contem "[Renovacao]" ou tipo_relacao = "CLIENTE_IR":
   - Pular qualificacao
   - Escalar direto para humano
   - Mensagem: "Vi que voce ja e nosso cliente! Vou te conectar com a equipe que cuida da sua conta."

---

## RESUMO DAS PRIORIDADES

| Prioridade | Problema | Impacto |
|------------|----------|---------|
| Alta | "Perfeito!" repetitivo | Quebra naturalidade em TODA conversa |
| Alta | Bloco 3 perguntas em contexto errado | Lead insatisfeito na primeira interacao |
| Alta | Promessas falsas de servicos | Risco de credibilidade |
| Alta | Mensagens duplicadas | Experiencia ruim e confusa |
| Media | Falta de desqualificacao | Gasta recursos com leads sem potencial |
| Media | Renovacao nao detectada | Clientes existentes tratados como novos |
| Media | Continuacao de conversa | Repetir apresentacao irrita o lead |

---

## DETALHES TECNICOS

### Alteracoes no sanitizador (Fase 1)
Adicionar ao array de patterns na funcao `sanitizeRoboticResponse`:
```text
/^(Perfeito|Entendi|Entendido|Excelente|Ótimo|Ótima|Legal|Maravilha|Show|Certo|Claro)[!.]?\s*/i
```
Isso remove essas palavras-muleta quando usadas sozinhas no inicio (sem nome depois).

### Prompt: novas regras (Fase 1)
Adicionar secao ao SYSTEM_PROMPT:
```text
PALAVRAS-MULETA PROIBIDAS NO INICIO:
"Perfeito!", "Entendi!", "Otimo!", "Excelente!", "Certo!", "Legal!"
Essas palavras no inicio sao marca de robo. 
USE: ir direto ao assunto ou variacao natural.
```

E regra contra fabricar processos:
```text
NUNCA PROMETA SERVICOS QUE VOCE NAO TEM CERTEZA QUE EXISTEM.
Se o lead pede algo fora do escopo (indicacao, networking, encaminhamento):
"Vou verificar com a equipe se temos algo nessa linha. Te retorno, tá?"
NAO invente departamentos, redes de parceiros ou processos.
```

### Deduplicacao Blue Chat (Fase 4)
Na funcao principal do `bluechat-inbound`, antes de salvar:
```text
1. Buscar lead_messages WHERE lead_id = X AND conteudo = hash AND created_at > now()-30s
2. Se encontrou → return 200 { deduplicated: true }
```

### Continuacao de conversa (Fase 5)
No `bluechat-inbound`:
```text
1. Buscar lead_messages WHERE lead_id = X AND created_at > now()-2h
2. Se encontrou → isReturningLead = true
3. Passar flag para sdr-ia-interpret
4. No interpret, se isReturningLead: pular apresentacao, usar historico existente
```
