
# Eliminar Atendimentos no Limbo: Escalacao e Devolucao Inteligente

## Problema Identificado

Existem 3 falhas criticas que deixam atendimentos "no limbo":

1. **ESCALAR_HUMANO sem efeito no modo passivo**: A acao `ESCALAR_HUMANO` no `sdr-ia-interpret` so registra evento se houver `runId`. No Blue Chat (modo passivo), `runId` e sempre `null`, entao a escalacao nao faz nada.

2. **Callback so acontece com resposta**: O envio de callback ao Blue Chat (incluindo transferencia de ticket) so executa se `iaResult?.responseText` existir. Quando a IA nao gera resposta (ex: `NAO_ENTENDI`), nenhum callback e disparado - nem a transferencia do ticket.

3. **`NAO_ENTENDI` sem acao definida**: Quando a IA retorna `NAO_ENTENDI`, a acao e `ESCALAR_HUMANO` mas sem resposta, o resultado final no Blue Chat e `QUALIFY_ONLY` - nada acontece e o lead fica sem atendimento.

## Solucao Proposta

### Regra de Negocio

```text
Se NAO_ENTENDI (sem contexto previo):
  -> Gerar pergunta de contexto ("Em que posso te ajudar?")
  -> action = RESPOND

Se NAO_ENTENDI (com contexto previo):
  -> Escalar para humano COM transferencia de ticket
  -> action = ESCALATE

Se ESCALAR_HUMANO (qualquer cenario):
  -> SEMPRE gerar mensagem de transicao pro lead
  -> SEMPRE transferir ticket no Blue Chat
  -> action = ESCALATE
```

### Mudancas Tecnicas

#### 1. `bluechat-inbound/index.ts` - Tratar respostas vazias com escalacao

Alterar a logica de decisao de action (linhas ~1030-1040) para:

- Se `iaResult?.escalation?.needed` e verdadeiro mas nao ha `responseText`, gerar uma mensagem padrao de transicao (ex: "Vou te conectar com alguem da equipe que pode te ajudar melhor com isso!")
- Se `iaResult` retornou `null` (falha total na IA), tratar como `ESCALATE` automatico com mensagem padrao
- Se `intent === NAO_ENTENDI` e nao ha contexto previo (historico vazio ou < 2 mensagens), forcar `RESPOND` com pergunta de contexto

#### 2. `bluechat-inbound/index.ts` - Callback independente de resposta

Mover a logica de callback para que:

- Se `action === 'ESCALATE'`, SEMPRE chamar `sendResponseToBluechat` com a mensagem de transicao e executar transferencia de ticket, mesmo que a IA nao tenha gerado texto
- Persistir a mensagem OUTBOUND de transicao no `lead_messages`

#### 3. `sdr-ia-interpret/index.ts` - ESCALAR_HUMANO no modo passivo

Na funcao `applyAction`, adicionar tratamento para quando `runId` e `null`:

- Registrar a escalacao como evento independente (log no console)
- Retornar `true` para indicar que a acao foi aplicada
- O resultado `escalation.needed = true` ja e propagado para o `bluechat-inbound` corretamente

#### 4. `sdr-ia-interpret/index.ts` - NAO_ENTENDI deve gerar resposta

No prompt da IA ou na logica pos-interpretacao:

- Quando `intent === NAO_ENTENDI` e `source === BLUECHAT`, forcar `deve_responder = true` e gerar resposta de contextualizacao
- Exemplo: "Oi! Sou a Amelia, do comercial. Como posso te ajudar?"

### Fluxo Corrigido

```text
Mensagem chega no bluechat-inbound
        |
   sdr-ia-interpret processa
        |
   +---------+---------+---------+
   |         |         |         |
NAO_ENTENDI  ESCALAR   RESPOND   RESOLVE
(sem ctx)   HUMANO
   |         |         |         |
Pergunta   Mensagem   Resposta  Encerra
contexto   transicao  normal    ticket
   |         |
RESPOND    ESCALATE
   |         |
Callback   Callback + Transfer ticket
```

### Mensagens Padrao

| Cenario | Mensagem |
|---------|----------|
| NAO_ENTENDI sem contexto | "Oi! Sou a Amelia, do comercial do Grupo Blue. Em que posso te ajudar?" |
| NAO_ENTENDI com contexto | "Hmm, deixa eu pedir ajuda de alguem da equipe pra te atender melhor. Ja ja entram em contato!" |
| ESCALAR_HUMANO sem resposta | "Vou te conectar com alguem da equipe que pode te ajudar melhor com isso!" |
| Falha total na IA (null) | "Estamos com um problema tecnico. Vou te conectar com um atendente agora!" |

### Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/bluechat-inbound/index.ts` | Tratar escalacao sem resposta, callback independente, mensagens padrao |
| `supabase/functions/sdr-ia-interpret/index.ts` | ESCALAR_HUMANO sem runId, NAO_ENTENDI gerar resposta para BLUECHAT |

### Sequencia de Execucao

1. Modificar `sdr-ia-interpret` para gerar resposta em cenarios NAO_ENTENDI + BLUECHAT
2. Modificar `sdr-ia-interpret` para tratar ESCALAR_HUMANO sem runId
3. Modificar `bluechat-inbound` para nunca deixar atendimento sem acao
4. Modificar `bluechat-inbound` para callback de escalacao independente de responseText
5. Deploy das duas edge functions
6. Testar cenario do IVAN (NAO_ENTENDI com triagem)
