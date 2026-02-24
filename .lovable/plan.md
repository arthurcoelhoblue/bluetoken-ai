

## Correcao: Amelia envia cumprimento duplicado (2-3 vezes)

### Problema

A Amelia envia mensagens de apresentacao ("Sou a Amelia...") multiplas vezes para o mesmo lead. Encontrei 8 leads afetados nos ultimos 14 dias.

**Dois cenarios identificados:**

1. **Webhooks duplicados rapidos** (caso Tokeniza: 3 cumprimentos em 1 minuto). O Blue Chat dispara multiplos `[NOVO ATENDIMENTO]` para o mesmo lead em sequencia. O dedup atual compara conteudo exato com janela de 30 segundos, mas o conteudo do `[NOVO ATENDIMENTO]` muda levemente a cada webhook (historico cresce), entao o dedup nao pega.

2. **Ticket reaberto** (caso Arthur Coelho: 3 cumprimentos em 50 minutos). O lead reenvia a mesma mensagem, Blue Chat gera um novo `[NOVO ATENDIMENTO]`, e a Amelia trata como conversa nova — se reapresentando a cada vez.

### Causa raiz tecnica

**1. Sem trava de "ja cumprimentou"**
O classifier (linha 441 de `intent-classifier.ts`) checa se ha outbound no historico para decidir se e "PRIMEIRA interacao". Porem quando chega um `[NOVO ATENDIMENTO]`, o contexto pode nao conter o historico anterior, fazendo a IA achar que precisa se apresentar novamente.

**2. Dedup insuficiente para triagem**
O dedup de conteudo em `bluechat-inbound` (linhas 151-180) usa comparacao exata de texto com janela de 30s. Os `[NOVO ATENDIMENTO]` de mesmo lead tem conteudo ligeiramente diferente e chegam com mais de 30s de distancia.

**3. Estado resetado no [NOVO ATENDIMENTO]**
Em `bluechat-inbound` (linhas 400-428), quando chega `[NOVO ATENDIMENTO]` e nao e "lead retornando" (< 2h), o `estado_funil` pode ser resetado, perdendo o contexto de que a Amelia ja interagiu.

### Solucao (3 camadas de protecao)

**Camada 1: Dedup de triagem por lead + janela de 5 minutos**
Em `bluechat-inbound/index.ts`, apos detectar o `triageSummary` (linha 374), verificar se ja existe uma mensagem INBOUND com `[NOVO ATENDIMENTO]` para esse lead nos ultimos 5 minutos. Se existir, tratar como duplicata e retornar sem acionar a IA.

```text
Arquivo: supabase/functions/bluechat-inbound/index.ts
Local: Apos linha 374 (parseTriageSummary)
```

**Camada 2: Flag "ja_cumprimentou" no conversation_state**
Em `sdr-ia-interpret/action-executor.ts`, quando a Amelia envia uma resposta com apresentacao (contem "sou a Amelia/Maria"), gravar um flag `ja_cumprimentou: true` no `framework_data`. Esse flag persiste entre reaberturas de ticket.

```text
Arquivo: supabase/functions/sdr-ia-interpret/action-executor.ts
Local: Apos enviar resposta com sucesso
```

**Camada 3: Instrucao no prompt do classifier**
Em `intent-classifier.ts`, ALEM de checar `ameliaOutbound.length === 0`, verificar o flag `ja_cumprimentou` no `framework_data`. Se true, adicionar instrucao "VOCE JA SE APRESENTOU. NAO se reapresente. Continue a conversa naturalmente."

```text
Arquivo: supabase/functions/sdr-ia-interpret/intent-classifier.ts
Local: Linha 440-441 (bloco de primeira interacao)
```

### Arquivos afetados

1. `supabase/functions/bluechat-inbound/index.ts` — dedup de triagem (5 min)
2. `supabase/functions/sdr-ia-interpret/action-executor.ts` — gravar flag `ja_cumprimentou`
3. `supabase/functions/sdr-ia-interpret/intent-classifier.ts` — respeitar flag no prompt

### Sequencia

1. Editar `bluechat-inbound/index.ts` — adicionar dedup de `[NOVO ATENDIMENTO]` por lead (5 min)
2. Editar `action-executor.ts` — gravar `ja_cumprimentou` no framework_data
3. Editar `intent-classifier.ts` — checar flag e instruir IA a nao se reapresentar
4. Deploy das 2 edge functions afetadas (`bluechat-inbound`, `sdr-ia-interpret`)

