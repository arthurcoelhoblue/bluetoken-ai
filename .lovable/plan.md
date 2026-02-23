
## Corrigir envio Blue Chat no sdr-proactive-outreach

### Problema raiz
Para contatos novos (sem conversa prévia), nao existe `conversationId` nem `ticketId`. A API Blue Chat exige `ticketId` no `POST /messages` e retorna 400 quando ausente. Enviar apenas `phone` nao basta para criar o ticket automaticamente.

### Evidencia do padrao que funciona
No `bluechat-inbound/callback.ts` (linha 137-143), o envio que funciona sempre envia `ticketId`, usando `conversation_id` como fallback:
```text
ticketId: data.ticket_id || data.conversation_id
```

Ja no `whatsapp-send/index.ts` (manual), ele exige que `conversationId` exista previamente (linha 106-111) e retorna erro se nao houver.

Ou seja: **nenhum fluxo atual cria uma conversa do zero** — todos dependem de um ticket/conversa ja existente (iniciado pelo lead via Blue Chat).

### Solucao
Para a abordagem proativa funcionar com contatos novos, a funcao precisa **criar o ticket primeiro** e depois enviar a mensagem. A tentativa anterior de usar `POST /conversations` falhou com 404. A solucao e usar o endpoint correto de criacao de ticket do Blue Chat.

#### Mudanca 1: Descobrir o endpoint correto de criacao de ticket
Verificar nos logs e na documentacao do Blue Chat qual endpoint cria tickets. Candidatos:
- `POST /tickets` (mais provavel)
- `POST /conversations` com payload diferente

#### Mudanca 2: Implementar fluxo em 2 etapas no `sdr-proactive-outreach`

```text
Se nao tem ticketId nem conversationId:
  1. POST /tickets { phone, contact_name, channel: "whatsapp", source: "AMELIA_SDR" }
  2. Extrair ticket_id e conversation_id da resposta
  3. POST /messages { ticketId, conversation_id, content, source, phone }
Se ja tem:
  Enviar direto como hoje (com ticketId obrigatorio)
```

#### Mudanca 3: Fallback defensivo
Se a criacao de ticket tambem falhar (endpoint inexistente), retornar erro explicito com orientacao: "Este contato precisa iniciar uma conversa via WhatsApp primeiro para ser abordado pela Amelia."

### Arquivo alterado
| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/sdr-proactive-outreach/index.ts` | Adicionar criacao de ticket via `POST /tickets` antes do envio de mensagem quando nao houver ticket existente |

### Risco
O endpoint `POST /tickets` pode nao existir ou ter payload diferente. Mitigacao: parsing defensivo e fallback com mensagem clara ao usuario.
