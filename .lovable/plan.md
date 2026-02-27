
# Auto-criar Lead para Mensagens UNMATCHED no Inbound

## Problema

Quando uma mensagem chega de um numero desconhecido (sem lead cadastrado na BLUE_LABS), o sistema salva a mensagem com `lead_id = null` e `estado = 'UNMATCHED'`. A pagina `/conversas` usa o hook `useAtendimentos` que busca leads em `lead_contacts` -- como nao existe registro, a conversa nunca aparece.

## Solucao

No `saveInboundMessage`, quando o resultado for UNMATCHED, criar automaticamente um registro em `lead_contacts` (e consequentemente em `contacts` via trigger `fn_sync_lead_to_contact`) com os dados disponiveis (telefone), e vincular a mensagem a esse novo lead.

## Alteracoes

### Arquivo: `supabase/functions/whatsapp-inbound/index.ts`

Na funcao `saveInboundMessage`, apos determinar que `isMatched = false`, adicionar logica para:

1. Gerar um `lead_id` unico (ex: `inbound_<phone_hash>_<timestamp>`)
2. Inserir em `lead_contacts` com:
   - `lead_id`: o ID gerado
   - `empresa`: a empresa-alvo (BLUE_LABS)
   - `telefone`: numero raw
   - `telefone_e164`: numero normalizado E.164
   - `nome`: null (desconhecido)
   - `origem_telefone`: 'WHATSAPP_INBOUND'
3. Atualizar o `messageRecord.lead_id` com o novo lead_id antes de salvar a mensagem
4. Mudar `estado` para 'RECEBIDO' (ja que agora tem lead vinculado)
5. O trigger `fn_sync_lead_to_contact` criara automaticamente o registro em `contacts`

### Pseudocodigo

```text
if (!isMatched) {
  // Auto-criar lead_contact para numero novo
  const newLeadId = `inbound_${phoneHash}_${Date.now()}`
  
  INSERT lead_contacts (lead_id, empresa, telefone, telefone_e164, origem_telefone)
  VALUES (newLeadId, empresa, raw_phone, e164_phone, 'WHATSAPP_INBOUND')
  
  // Vincular mensagem ao novo lead
  messageRecord.lead_id = newLeadId
  messageRecord.estado = 'RECEBIDO'
  isMatched = true
}
```

### Fluxo resultante

```text
Mensagem de numero desconhecido chega
  |
  v
resolveEmpresaFromWebhook() -> BLUE_LABS
  |
  v
findLeadByPhone() -> nao encontra nada
  |
  v
saveInboundMessage():
  - Detecta UNMATCHED
  - Cria lead_contact automaticamente na BLUE_LABS
  - Salva mensagem com lead_id do novo lead
  - Trigger fn_sync_lead_to_contact cria contact no CRM
  |
  v
/conversas mostra a nova conversa com "Lead sem nome" + telefone
```

## Cuidados

- Verificar se ja existe lead_contact com mesmo telefone_e164 + empresa antes de criar (evitar duplicatas em caso de retry)
- Usar `ON CONFLICT DO NOTHING` no insert do lead_contact como seguranca adicional
- O telefone E.164 ja esta disponivel no payload normalizado
- Nenhuma alteracao de banco necessaria (tabelas e triggers ja existem)
