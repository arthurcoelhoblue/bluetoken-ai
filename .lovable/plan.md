

## Plano: Correcoes de Cruzamento MarIA/Amelia e Ownership

### Problemas identificados

1. **Estado travado em ESCALAR_IMEDIATO**: Quando um novo handoff `[NOVO ATENDIMENTO]` chega, o lead ainda esta com `ultima_pergunta_id = ESCALAR_IMEDIATO`, impedindo a Amelia de retomar
2. **Lead registrou conversa em duas empresas**: O sistema cria registros espelho automaticamente, mas a Amelia pode responder na empresa errada
3. **Sem conceito de "dono" do lead**: A tabela `lead_contacts` nao tem campo de responsavel/owner
4. **Amelia responde agradecimento da MarIA**: Ela le so a ultima mensagem e responde "obrigado" sem contexto, saindo do fluxo
5. **Ticket ja encerrado pela MarIA**: Quando devolvem pra Amelia mas o ticket ja foi resolvido, ela tenta responder e falha

---

### Mudanca 1: Reset de estado no [NOVO ATENDIMENTO]

**Arquivo:** `supabase/functions/bluechat-inbound/index.ts` (apos linha 954)

Quando detectar `[NOVO ATENDIMENTO]` (triageSummary != null e nao e lead retornando), verificar o `lead_conversation_state`:
- Se `ultima_pergunta_id === 'ESCALAR_IMEDIATO'`, resetar para `NENHUMA`
- Se `estado_funil === 'ESCALAR_IMEDIATO'` ou estado terminal, resetar para `DIAGNOSTICO`
- Resetar `ia_null_count` para 0 no `framework_data`

```text
Logica:
  Se triageSummary detectado E nao e lead retornando:
    Buscar lead_conversation_state
    Se ultima_pergunta_id == 'ESCALAR_IMEDIATO':
      UPDATE ultima_pergunta_id = 'NENHUMA'
      UPDATE estado_funil = 'DIAGNOSTICO'
      UPDATE framework_data.ia_null_count = 0
      Log: "[Triage] Estado ESCALAR_IMEDIATO resetado para novo atendimento"
```

---

### Mudanca 2: Campo `owner_id` em lead_contacts + auto-assign no takeover

**Migration SQL:** Adicionar coluna `owner_id UUID REFERENCES profiles(id) NULL` em `lead_contacts`

**Arquivo:** `src/hooks/useConversationMode.ts`

No `useConversationTakeover`, ao executar acao `ASSUMIR`:
- Verificar se `lead_contacts.owner_id` e null para aquele lead+empresa
- Se null, fazer UPDATE `owner_id = user.id`
- Se ja tem dono, nao sobrescrever (o vendedor pode transferir manualmente depois)

**UI:** Exibir o dono atual do lead no `ConversationTakeoverBar` e adicionar botao "Transferir" que permite selecionar outro usuario cadastrado

---

### Mudanca 3: Amelia deve ler contexto completo, nao so ultima mensagem

**Arquivo:** `supabase/functions/bluechat-inbound/index.ts`

Antes de chamar `callSdrIaInterpret`, verificar se a mensagem atual e um agradecimento direcionado a outro agente (MarIA):
- Se a mensagem contem palavras de agradecimento ("obrigado", "obrigada", "valeu") E o historico recente contem mensagens de triagem (MarIA), a Amelia deve:
  1. NAO tratar como encerramento
  2. Se apresentar e dar continuidade: ignorar o agradecimento como intent de fechamento
  
**Arquivo:** `supabase/functions/sdr-ia-interpret/index.ts`

No prompt de sistema, adicionar instrucao explicita:
- "Se o lead esta agradecendo o atendente anterior (triagem/MarIA), IGNORE o agradecimento como sinal de encerramento. Apresente-se como Amelia e continue a qualificacao a partir do contexto da triagem."
- O historico ja e carregado (ultimas 10 mensagens), mas a regra de encerramento no `bluechat-inbound` (linhas 999-1033) nao considera se o agradecimento e para a MarIA

**Mudanca especifica no bluechat-inbound (linhas 999-1033):**
- Adicionar condicao: se `triageSummary` foi detectado na mesma sessao (ou lead tem < 3 mensagens OUTBOUND da Amelia), NAO marcar como `isConversationEnding` mesmo com keyword de agradecimento
- Isso evita que um "obrigado" direcionado a MarIA encerre o ticket antes da Amelia comecar

---

### Mudanca 4: Verificar ticket resolvido antes de responder

**Arquivo:** `supabase/functions/bluechat-inbound/index.ts`

Antes de enviar callback (linha 1249), verificar se o ticket ainda esta aberto:
- Buscar status do ticket via Blue Chat API: `GET /tickets/{ticket_id}`
- Se ticket ja esta `resolved` ou `closed`, a Amelia NAO envia resposta e NAO escala
- Log: "[BlueChat] Ticket ja resolvido, Amelia ficando muda"
- Retornar `action: QUALIFY_ONLY` (registra internamente mas nao envia nada)

Como alternativa mais simples (sem depender da API do Blue Chat): armazenar flag `ticket_resolved: true` no `framework_data` quando a Amelia executa RESOLVE, e verificar essa flag antes de responder em mensagens subsequentes.

---

### Mudanca 5: Amelia se apresentar ao iniciar atendimento pos-handoff

**Arquivo:** `supabase/functions/sdr-ia-interpret/index.ts`

No prompt, quando `triageSummary` esta presente:
- Adicionar instrucao: "Voce DEVE se apresentar como Amelia na primeira resposta apos receber o handoff da triagem. Exemplo: 'Oi [nome], aqui e a Amelia! Vi que voce precisa de [contexto da triagem]...'"
- Verificar se ja existe pelo menos 1 mensagem OUTBOUND da Amelia no historico. Se nao, e a primeira interacao e ela deve se apresentar.

---

### Resumo dos arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/bluechat-inbound/index.ts` | Reset ESCALAR_IMEDIATO no handoff, protecao contra agradecimento a MarIA, verificacao ticket resolvido |
| `supabase/functions/sdr-ia-interpret/index.ts` | Instrucoes de apresentacao pos-handoff, ignorar agradecimento a MarIA |
| `src/hooks/useConversationMode.ts` | Auto-assign owner no takeover |
| `src/components/conversas/ConversationTakeoverBar.tsx` | Exibir dono + botao transferir |
| Migration SQL | Adicionar `owner_id` em `lead_contacts` |

### Ordem de implementacao

1. Migration: campo `owner_id`
2. `bluechat-inbound`: reset estado + protecao agradecimento + verificacao ticket
3. `sdr-ia-interpret`: instrucoes de apresentacao e contexto
4. Frontend: takeover com ownership

